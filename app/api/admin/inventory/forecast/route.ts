import { getApiAdmin } from "@/lib/auth/api-guards";
import { getInventoryForecast } from "@/lib/inventory/service";
import { errorCode, getCorrelationId, logEvent } from "@/lib/observability/logger";
import { jsonError } from "@/lib/utils/api";
import { distributedRateLimit, getRequestKey, retryAfterHeaders } from "@/lib/utils/rate-limit";

function rangeFrom(request: Request): 30 | 60 | 90 {
  const value = Number(new URL(request.url).searchParams.get("range") ?? 30);
  return value === 60 || value === 90 ? value : 30;
}

export async function GET(request: Request) {
  const requestId = getCorrelationId(request);
  const limit = await distributedRateLimit(getRequestKey(request, "admin-inventory-forecast"), 30, 60_000);
  if (!limit.ok) return jsonError("Demasiadas solicitudes.", 429, retryAfterHeaders(limit));
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);
  try {
    const result = await getInventoryForecast(rangeFrom(request));
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    logEvent("error", "inventory.forecast_failed", { request_id: requestId, reason: errorCode(error) });
    const message = error instanceof Error ? error.message : "No pudimos calcular la reposición.";
    return jsonError(message, 503, { "Cache-Control": "private, no-store" });
  }
}
