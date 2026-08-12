import { createNaranjaXPaymentIntent, isNaranjaXEnabled } from "@/lib/payments/naranjax";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "naranjax-status"), 60, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Esperá un momento.", 429, retryAfterHeaders(limit));
  return Response.json({
    provider: "NARANJAX",
    enabled: isNaranjaXEnabled(),
    message: isNaranjaXEnabled() ? "Naranja X listo para integrar con credenciales oficiales." : "Naranja X estara disponible proximamente."
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "naranjax-create"), 8, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Esperá un momento.", 429, retryAfterHeaders(limit));
  try {
    const result = await createNaranjaXPaymentIntent();
    return Response.json(result);
  } catch {
    return jsonError("No pudimos iniciar Naranja X.", 400);
  }
}
