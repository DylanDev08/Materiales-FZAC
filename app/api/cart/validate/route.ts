import { ZodError } from "zod";
import { inspectCheckoutStock } from "@/lib/db/orders";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "cart-validate"), 60, 60_000);
  const mutation = validateJsonMutationRequest(request, 48 * 1024);
  if (!limit.ok) return jsonError("Demasiadas validaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  try {
    const payload = await request.json();
    const result = await inspectCheckoutStock(payload);
    if (!result.ok) {
      return Response.json(
        {
          ok: false,
          error: "INSUFFICIENT_STOCK",
          message: "Revisá las cantidades: uno o más productos cambiaron de disponibilidad.",
          items: result.issues,
          products: result.items
        },
        { status: 409 }
      );
    }
    return Response.json({ ok: true, products: result.items });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Carrito invalido.", 422);
    return jsonError("No pudimos validar el stock en este momento.", 400);
  }
}
