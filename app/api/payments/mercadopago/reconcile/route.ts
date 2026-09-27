import { z } from "zod";
import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMercadoPagoPayment, sanitizeMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { paymentLiveModeMatchesEnvironment } from "@/lib/payments/config";
import { confirmApprovedPayment, finalizeFailedPayment } from "@/lib/payments/payment-service";
import {
  mercadoPagoWebhookAction,
  paymentAmountMatchesLocal,
  paymentStatusFromMercadoPago
} from "@/lib/payments/mercadopago-webhook-policy";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";

const schema = z.object({
  orderId: z.string().uuid(),
  paymentId: z.string().regex(/^\d+$/)
});

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "mercadopago-return-reconcile"), 20, 60_000);
  if (!limit.ok) return jsonError("Demasiadas verificaciones. Esperá un momento.", 429, retryAfterHeaders(limit));

  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);
  const parsed = schema.safeParse(body.data);
  if (!parsed.success) return jsonError("Referencia de pago inválida.", 422);

  const profile = await getUserProfile();
  if (!profile) return jsonError("Necesitás iniciar sesión para verificar el pago.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend de pagos no disponible.", 503);

  const { data: order } = await admin
    .from("orders")
    .select("id,user_id,status,total")
    .eq("id", parsed.data.orderId)
    .maybeSingle();

  if (!order) return jsonError("Pedido no encontrado.", 404);
  if (profile.role !== "ADMIN" && String(order.user_id ?? "") !== profile.id) {
    return jsonError("No autorizado.", 403);
  }

  if (String(order.status) === "PENDING_ADMIN_APPROVAL") {
    return Response.json(
      {
        ok: true,
        status: "PENDING_ADMIN_APPROVAL",
        requires_admin_approval: true,
        message: "Esta compra requiere aprobación administrativa antes de continuar el pago."
      },
      { status: 409 }
    );
  }

  const { data: localPayment } = await admin
    .from("payments")
    .select("id,order_id,provider,status,amount,currency,provider_payment_id")
    .eq("order_id", parsed.data.orderId)
    .maybeSingle();

  if (!localPayment || localPayment.provider !== "MERCADOPAGO") {
    return jsonError("El pedido no tiene un pago de Mercado Pago asociado.", 409);
  }

  const providerPayment = await getMercadoPagoPayment(parsed.data.paymentId).catch(() => null);
  if (!providerPayment) return jsonError("Todavía no pudimos consultar el pago en Mercado Pago.", 503);

  const metadata = (providerPayment.metadata ?? {}) as Record<string, unknown>;
  const externalReference = String(providerPayment.external_reference || metadata.order_id || "");
  if (externalReference !== parsed.data.orderId) {
    return jsonError("El pago no corresponde a este pedido.", 409);
  }

  if (!paymentLiveModeMatchesEnvironment(providerPayment.live_mode)) {
    return jsonError("El entorno del pago no coincide con el entorno de FZAC.", 409);
  }

  if (!paymentAmountMatchesLocal(providerPayment, localPayment)) {
    return jsonError("El monto o la moneda del pago no coincide con el pedido.", 409);
  }

  const providerStatus = String(providerPayment.status ?? "");
  const action = mercadoPagoWebhookAction(providerStatus);
  const providerPaymentId = String(providerPayment.id ?? parsed.data.paymentId);
  const safePayment = sanitizeMercadoPagoPayment(providerPayment);

  if (action === "CONFIRM") {
    await confirmApprovedPayment({
      orderId: parsed.data.orderId,
      provider: "MERCADOPAGO",
      providerPaymentId,
      raw: safePayment,
      status: "PAID"
    });

    return Response.json(
      { ok: true, status: "PAID", orderId: parsed.data.orderId },
      { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } }
    );
  }

  const mapped = paymentStatusFromMercadoPago(providerStatus);
  if (mapped === "FAILED" || mapped === "EXPIRED") {
    await finalizeFailedPayment({
      orderId: parsed.data.orderId,
      providerPaymentId,
      raw: safePayment,
      paymentStatus: mapped,
      providerStatus
    });
  } else {
    await admin
      .from("payments")
      .update({
        status: mapped,
        provider_payment_id: providerPaymentId,
        raw: safePayment,
        updated_at: new Date().toISOString()
      })
      .eq("id", localPayment.id);
  }

  return Response.json(
    { ok: true, status: mapped, orderId: parsed.data.orderId },
    { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } }
  );
}
