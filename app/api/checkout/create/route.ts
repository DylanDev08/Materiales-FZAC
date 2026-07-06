import { ZodError } from "zod";
import { createCheckout, InsufficientStockError, ShippingQuoteError } from "@/lib/db/orders";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { checkoutCreateSchema } from "@/lib/validations/checkout";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "checkout-create"), 12, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Proba nuevamente en un minuto.", 429);

  try {
    const payload = checkoutCreateSchema.parse(await request.json());
    const result = await createCheckout(payload);
    return Response.json(result);
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
          error: "PAYMENT_PROVIDER_NOT_CONFIGURED",
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
    return jsonError("No pudimos crear el checkout. Revisa los datos e intenta nuevamente.", 400);
  }
}
