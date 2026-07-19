import { ZodError } from "zod";
import { InsufficientStockError, validateCheckoutStock } from "@/lib/db/orders";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "cart-validate"), 60, 60_000);
  if (!limit.ok) return jsonError("Demasiadas validaciones. Proba nuevamente en un minuto.", 429, retryAfterHeaders(limit));

  try {
    const payload = await request.json();
    await validateCheckoutStock(payload);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Carrito invalido.", 422);
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
    return jsonError("No pudimos validar el stock en este momento.", 400);
  }
}
