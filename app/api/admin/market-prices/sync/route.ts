import { getApiAdmin } from "@/lib/auth/api-guards";
import { syncMarketPriceFeeds } from "@/lib/market-pricing/service";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 1_024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const limit = rateLimit(getRequestKey(request, "admin-market-price-sync"), 5, 60_000);
  if (!limit.ok) return jsonError("Esperá antes de volver a sincronizar.", 429, retryAfterHeaders(limit));
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);
  try {
    const summary = await syncMarketPriceFeeds();
    return Response.json({ ok: true, summary });
  } catch {
    return jsonError("No pudimos iniciar la lectura de fuentes.", 500);
  }
}
