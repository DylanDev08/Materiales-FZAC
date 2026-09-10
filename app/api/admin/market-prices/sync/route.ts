import { getApiAdmin } from "@/lib/auth/api-guards";
import { syncMarketPriceFeeds } from "@/lib/market-pricing/service";
import { jsonError } from "@/lib/utils/api";
import {
  acquireRequestConcurrency,
  getRequestKey,
  rateLimit,
  rateLimitIdentity,
  retryAfterHeaders
} from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 1_024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const limit = rateLimit(getRequestKey(request, "admin-market-price-sync"), 5, 60_000);
  if (!limit.ok) return jsonError("Esperá antes de volver a sincronizar.", 429, retryAfterHeaders(limit));
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);
  const identityLimit = rateLimitIdentity("admin-market-price-sync", profile.id, 2, 5 * 60_000);
  if (!identityLimit.ok) return jsonError("Esperá antes de iniciar otra sincronización.", 429, retryAfterHeaders(identityLimit));
  const slot = acquireRequestConcurrency(request, {
    scope: "market-price-sync",
    identity: profile.id,
    maxGlobal: 1,
    maxPerIp: 1,
    maxPerIdentity: 1,
    leaseMs: 2 * 60_000
  });
  if (!slot.ok) return jsonError("La sincronización ya está en curso.", 429, retryAfterHeaders(slot));
  try {
    const summary = await syncMarketPriceFeeds();
    return Response.json({ ok: true, summary });
  } catch {
    return jsonError("No pudimos iniciar la lectura de fuentes.", 500);
  } finally {
    slot.release();
  }
}
