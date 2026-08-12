import { timingSafeEqual } from "node:crypto";
import { syncMarketPriceFeeds } from "@/lib/market-pricing/service";
import { jsonError } from "@/lib/utils/api";
import { hasRealValue } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "market-price-cron"), 3, 5 * 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos.", 429, retryAfterHeaders(limit));
  const secret = process.env.MARKET_PRICE_CRON_SECRET?.trim() ?? "";
  if (!hasRealValue(secret)) return jsonError("Automatización no configurada.", 503);
  const authorization = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(authorization);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return jsonError("No autorizado.", 401);
  try {
    const summary = await syncMarketPriceFeeds();
    return Response.json({ ok: true, summary });
  } catch {
    return jsonError("No pudimos sincronizar referencias.", 500);
  }
}
