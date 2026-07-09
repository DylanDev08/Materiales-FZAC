import { ZodError } from "zod";
import { createCheckout, InsufficientStockError, ShippingQuoteError } from "@/lib/db/orders";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "checkout"), 12, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Proba nuevamente en un minuto.", 429);

  try {
    const payload = await request.json();
    const result = await createCheckout(payload);
    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Datos de checkout invalidos.", 422);
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
    if (error instanceof Error && error.message.startsWith("El proveedor de pago rechazo")) {
      return Response.json(
        {
          error: "PAYMENT_PREFERENCE_REJECTED",
          message: "No pudimos iniciar Mercado Pago. Revisamos la configuracion del retorno y podes intentar nuevamente."
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
