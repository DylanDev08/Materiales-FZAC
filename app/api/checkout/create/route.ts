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
import { jsonError } from "@/lib/utils/api";
import {
  acquireRequestConcurrency,
  getRequestKey,
  rateLimit,
  rateLimitIdentity,
  retryAfterHeaders
} from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";
import { checkoutCreateSchema } from "@/lib/validations/checkout";

function logCheckoutResult(result: { order_id?: string; orderId?: string; payment_method?: string; redirect_url?: string | null }) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[checkout.create]", {
    payment_method: result.payment_method ?? "-",
    order_id: result.order_id ?? result.orderId ?? null,
    redirect_url_exists: Boolean(result.redirect_url)
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "checkout-create"), 8, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));
  const body = await readLimitedJson(request, 64 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);

  try {
    const payload = checkoutCreateSchema.parse(body.data);
    const identityLimit = rateLimitIdentity("checkout-purchase", payload.customer.email, 8, 10 * 60_000);
    if (!identityLimit.ok) {
      return jsonError("Alcanzaste el límite de intentos de compra. Esperá unos minutos.", 429, retryAfterHeaders(identityLimit));
    }
    const slot = acquireRequestConcurrency(request, {
      scope: "checkout-purchase",
      identity: payload.customer.email,
      maxGlobal: 8,
      maxPerIp: 2,
      maxPerIdentity: 1,
      leaseMs: 45_000
    });
    if (!slot.ok) {
      return jsonError("Ya estamos procesando esta compra. No vuelvas a enviar el pago.", 429, retryAfterHeaders(slot));
    }

    try {
      const result = await createCheckout(payload);
      logCheckoutResult(result);
      return Response.json(result, { status: 201 });
    } finally {
      slot.release();
    }
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0]?.message;
      return Response.json(
        {
          ok: false,
          error: "VALIDATION_ERROR",
          message: issue && issue !== "Required" ? issue : "Completa los datos requeridos para continuar."
        },
        { status: 422 }
      );
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
    if (error instanceof MercadoPagoNotConfiguredError) {
      return Response.json(
        {
          ok: false,
          code: "MERCADOPAGO_NOT_CONFIGURED",
          error: "MERCADOPAGO_NOT_CONFIGURED",
          message: error.message,
          orderId: error.orderId
        },
        { status: 503 }
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
    if (
      error instanceof Error &&
      (error.message.startsWith("El proveedor de pago rechazo") ||
        error.message.startsWith("El proveedor de pago no devolvio"))
    ) {
      return Response.json(
        {
          error: "PAYMENT_PREFERENCE_REJECTED",
          message: "No pudimos iniciar Mercado Pago. Revisá que las credenciales correspondan al entorno configurado."
        },
        { status: 502 }
      );
    }
    if (
      error instanceof Error &&
      [
        "No pudimos crear la orden.",
        "No pudimos validar los productos del carrito.",
        "Un producto del carrito ya no esta disponible."
      ].includes(error.message)
    ) {
      return jsonError(error.message, 400);
    }
    return jsonError("No pudimos crear el checkout. Revisá los datos e intentá nuevamente.", 400);
  }
}
