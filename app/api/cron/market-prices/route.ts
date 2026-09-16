import { timingSafeEqual } from "node:crypto";
import { syncMarketPriceFeeds } from "@/lib/market-pricing/service";
import { jsonError } from "@/lib/utils/api";
import { hasRealValue } from "@/lib/utils/env";
import { errorCode, getCorrelationId, logEvent } from "@/lib/observability/logger";
import { acquireDistributedLock } from "@/lib/utils/distributed-lock";
import { acquireRequestConcurrency, distributedRateLimit, getRequestKey, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function POST(request: Request) {
  const requestId = getCorrelationId(request);
  const limit = await distributedRateLimit(getRequestKey(request, "market-price-cron"), 3, 5 * 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos.", 429, retryAfterHeaders(limit));
  const secret = process.env.MARKET_PRICE_CRON_SECRET?.trim() ?? "";
  if (!hasRealValue(secret)) return jsonError("Automatización no configurada.", 503);
  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return jsonError("No autorizado.", 401);
  const distributedLock = await acquireDistributedLock("market-price-sync", 2 * 60_000);
  if (distributedLock.status === "contended") return jsonError("La sincronizacion ya esta en curso.", 409);
  const slot = distributedLock.status === "unavailable" ? acquireRequestConcurrency(request, {
    scope: "market-price-sync",
    maxGlobal: 1,
    maxPerIp: 1,
    leaseMs: 2 * 60_000
  }) : { ok: true as const, retryAfter: 0, release: () => undefined };
  if (distributedLock.status === "unavailable") {
    logEvent("warn", "cron.market_prices.local_lock_fallback", { request_id: requestId });
  }
  if (!slot.ok) return jsonError("La sincronización ya está en curso.", 429, retryAfterHeaders(slot));
  try {
    const summary = await syncMarketPriceFeeds();
    logEvent("info", "cron.market_prices.completed", { request_id: requestId });
    return Response.json({ ok: true, summary });
  } catch (error) {
    logEvent("error", "cron.market_prices.failed", { request_id: requestId, reason: errorCode(error) });
    return jsonError("No pudimos sincronizar referencias.", 500);
  } finally {
    slot.release();
    await distributedLock.release();
  }
}
