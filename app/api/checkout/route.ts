import { ZodError } from "zod";
import { CheckoutAuthRequiredError, createCheckout, InsufficientStockError, ShippingQuoteError } from "@/lib/db/orders";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { checkoutCreateSchema } from "@/lib/validations/checkout";

function logCheckoutResult(result: { order_id?: string; orderId?: string; payment_method?: string; redirect_url?: string | null }) {
  if (process.env.NODE_ENV === "production") return;
  console.info("[checkout.legacy]", {
    payment_method: result.payment_method ?? "-",
    order_id: result.order_id ?? result.orderId ?? null,
    redirect_url_exists: Boolean(result.redirect_url)
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "checkout"), 12, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Proba nuevamente en un minuto.", 429);

  try {
    const rawPayload = await request.json();
    const parsedPayload = checkoutCreateSchema.safeParse(rawPayload);
    const payload = parsedPayload.success ? parsedPayload.data : rawPayload;
    const result = await createCheckout(payload);
    logCheckoutResult(result);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Datos de checkout invalidos.", 422);
    }
    if (error instanceof CheckoutAuthRequiredError) {
      return jsonError(error.message, error.status);
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
          message: "No pudimos iniciar Mercado Pago. Revisa que las credenciales correspondan al entorno configurado."
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
    if (error instanceof Error && error.message.includes("Supabase admin")) {
      return jsonError("Checkout no disponible. Revisamos la configuracion de pedidos del sistema.", 503);
    }
    return jsonError("No pudimos crear el checkout. Revisa los datos e intenta nuevamente.", 400);
  }
}
