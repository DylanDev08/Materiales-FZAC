import { ZodError } from "zod";
import {
  CheckoutAuthRequiredError,
  CheckoutIdempotencyError,
  CheckoutIntegrityError,
  createCheckout,
  InsufficientStockError,
  ShippingQuoteError
} from "@/lib/db/orders";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import {
  createMercadoPagoCardPayment,
  MercadoPagoCardPaymentError,
  sanitizeMercadoPagoPayment
} from "@/lib/payments/mercadopago";
import { confirmApprovedPayment } from "@/lib/payments/payment-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import {
  acquireRequestConcurrency,
  getRequestKey,
  rateLimit,
  rateLimitIdentity,
  retryAfterHeaders
} from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";
import { checkoutCardCreateSchema } from "@/lib/validations/checkout";

function paymentStatus(status: string) {
  if (status === "approved") return "PAID";
  if (status === "rejected" || status === "cancelled") return "FAILED";
  if (status === "refunded") return "REFUNDED";
  if (status === "expired") return "EXPIRED";
  return "PENDING";
}

function redirectForStatus(status: string, orderId: string) {
  const query = `order_id=${encodeURIComponent(orderId)}`;
  if (status === "approved") return `/pago/aprobado?${query}`;
  if (status === "rejected" || status === "cancelled" || status === "expired") return `/pago/rechazado?${query}`;
  return `/pago/pendiente?${query}`;
}

async function persistPaymentStatus(orderId: string, payment: Record<string, unknown>) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const status = String(payment.status ?? "");
  const mapped = paymentStatus(status);
  const safePayment = sanitizeMercadoPagoPayment(payment);
  const { data: existing } = await admin.from("payments").select("raw").eq("order_id", orderId).maybeSingle();
  const existingRaw = existing?.raw && typeof existing.raw === "object" ? existing.raw as Record<string, unknown> : {};
  await admin
    .from("payments")
    .update({
      status: mapped,
      provider_payment_id: payment.id ? String(payment.id) : null,
      raw: { ...existingRaw, provider_status: status, provider_payment: safePayment },
      updated_at: new Date().toISOString()
    })
    .eq("order_id", orderId);

  if (mapped === "FAILED" || mapped === "EXPIRED") {
    await admin.from("orders").update({ status: "CANCELLED", updated_at: new Date().toISOString() }).eq("id", orderId);
  }
}

async function existingCardPaymentResponse(paymentId: string, orderId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("payments")
    .select("status,provider_payment_id,raw")
    .eq("id", paymentId)
    .maybeSingle();
  if (!data?.provider_payment_id) return null;

  const raw = data.raw && typeof data.raw === "object" ? data.raw as Record<string, unknown> : {};
  const providerStatus = String(raw.provider_status ?? data.status ?? "pending").toLowerCase();
  const status = providerStatus === "paid" ? "approved" : providerStatus === "failed" ? "rejected" : providerStatus;

  return Response.json(
    {
      ok: true,
      orderId,
      status,
      redirectUrl: redirectForStatus(status, orderId),
      resumed: true,
      message: "Este intento de pago ya fue procesado. Recuperamos su estado sin generar otro cobro."
    },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "checkout-card"), 4, 60_000);
  if (!limit.ok) {
    return jsonError("Demasiados intentos de pago. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));
  }
  const body = await readLimitedJson(request, 64 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);

  try {
    const payload = checkoutCardCreateSchema.parse(body.data);
    const identity = payload.checkout.customer.email;
    const purchaseLimit = rateLimitIdentity("checkout-purchase", identity, 8, 10 * 60_000);
    const paymentLimit = rateLimitIdentity("checkout-card-payment", identity, 5, 15 * 60_000);
    const blocked = !purchaseLimit.ok ? purchaseLimit : !paymentLimit.ok ? paymentLimit : null;
    if (blocked) {
      return jsonError("Alcanzaste el límite de intentos de pago. Esperá unos minutos.", 429, retryAfterHeaders(blocked));
    }
    const slot = acquireRequestConcurrency(request, {
      scope: "checkout-purchase",
      identity,
      maxGlobal: 8,
      maxPerIp: 2,
      maxPerIdentity: 1,
      leaseMs: 60_000
    });
    if (!slot.ok) {
      return jsonError("Ya estamos procesando este pago. No vuelvas a enviarlo.", 429, retryAfterHeaders(slot));
    }

    try {
      const checkout = await createCheckout(payload.checkout);
      const orderId = checkout.orderId;
      const paymentId = checkout.paymentId;
      const total = Number(checkout.total ?? 0);

      if (!orderId || !paymentId || !total) return jsonError("No pudimos preparar la orden para pagar con tarjeta.", 400);
      if (checkout.requires_admin_approval) {
        return Response.json(
          {
            ok: true,
            orderId,
            status: checkout.order_status,
            redirectUrl: `/checkout/pending?orderId=${orderId}&approval=1`,
            message: checkout.message || "La compra requiere aprobación del administrador antes de pagar."
          },
          { status: 201 }
        );
      }

      const resumed = await existingCardPaymentResponse(paymentId, orderId);
      if (resumed) return resumed;

      const payment = await createMercadoPagoCardPayment({
        orderId,
        amount: total,
        description: `Compra Materiales FZAC ${orderId.slice(0, 8).toUpperCase()}`,
        token: payload.card.token,
        paymentMethodId: payload.card.payment_method_id,
        issuerId: payload.card.issuer_id,
        installments: payload.card.installments,
        payer: {
          email: payload.card.cardholder_email,
          identificationType: payload.card.identification_type,
          identificationNumber: payload.card.identification_number
        }
      });

      const status = String(payment.status ?? "pending");
      const safePayment = sanitizeMercadoPagoPayment(payment);
      if (status === "approved") {
        await confirmApprovedPayment({
          orderId,
          provider: "MERCADOPAGO",
          providerPaymentId: payment.id ? String(payment.id) : null,
          raw: safePayment,
          status: "PAID"
        });
      } else {
        await persistPaymentStatus(orderId, payment);
      }

      return Response.json(
        {
          ok: true,
          orderId,
          status,
          redirectUrl: redirectForStatus(status, orderId),
          message:
            status === "approved"
              ? "Pago aprobado."
              : "Mercado Pago devolvió el pago pendiente o rechazado. El stock no se descuenta sin aprobación."
        },
        { status: 201 }
      );
    } finally {
      slot.release();
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0]?.message;
      return jsonError(issue && issue !== "Required" ? issue : "Completa los datos requeridos para pagar con tarjeta.", 422);
    }
    if (error instanceof CheckoutAuthRequiredError) {
      return jsonError(error.message, error.status);
    }
    if (error instanceof CheckoutIdempotencyError || error instanceof CheckoutIntegrityError) {
      return Response.json(
        { ok: false, error: error.code, code: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (error instanceof InsufficientStockError) {
      return Response.json(
        {
          error: "INSUFFICIENT_STOCK",
          message: error.message,
          items: error.items
        },
        { status: 409 }
      );
    }
    if (error instanceof ShippingQuoteError) {
      return Response.json(
        {
          error: "SHIPPING_QUOTE_UNAVAILABLE",
          message: error.message,
          quote: error.quote ?? null
        },
        { status: 422 }
      );
    }
    if (error instanceof MercadoPagoNotConfiguredError) {
      return Response.json(
        {
          error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
          message: error.message
        },
        { status: 503 }
      );
    }
    if (error instanceof MercadoPagoCardPaymentError) {
      const status = error.status === 429 ? 429 : error.status === 401 || error.status === 403 ? 503 : error.status === 409 ? 409 : 422;
      return Response.json(
        {
          ok: false,
          error: error.code,
          message: error.message
        },
        { status, ...(status === 429 ? { headers: { "Retry-After": "30" } } : {}) }
      );
    }
    return jsonError("No pudimos procesar el pago con tarjeta.", 500);
  }
}
