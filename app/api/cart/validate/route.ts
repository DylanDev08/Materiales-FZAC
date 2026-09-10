import { ZodError } from "zod";
import { inspectCheckoutStock } from "@/lib/db/orders";
import { jsonError } from "@/lib/utils/api";
import { acquireRequestConcurrency, getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "cart-validate"), 30, 60_000);
  if (!limit.ok) return jsonError("Demasiadas validaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));
  const body = await readLimitedJson(request, 48 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);

  const slot = acquireRequestConcurrency(request, {
    scope: "cart-validate",
    maxGlobal: 20,
    maxPerIp: 2,
    leaseMs: 10_000
  });
  if (!slot.ok) return jsonError("Ya estamos validando tu carrito.", 429, retryAfterHeaders(slot));

  try {
    const payload = body.data;
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
  } finally {
    slot.release();
  }
}
