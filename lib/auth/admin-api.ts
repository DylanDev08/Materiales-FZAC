import "server-only";

import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { distributedRateLimitRequest, distributedRetryHeaders } from "@/lib/security/distributed-rate-limit";

type AdminApiOptions = {
  scope: string;
  limit?: number;
  windowMs?: number;
};

export async function getAdminApiContext(
  request: Request,
  { scope, limit = 60, windowMs = 60_000 }: AdminApiOptions
) {
  const requestLimit = rateLimit(getRequestKey(request, scope), limit, windowMs);
  if (!requestLimit.ok) {
    return {
      ok: false as const,
      response: jsonError(
        "Demasiadas solicitudes administrativas. Esperá un momento y volvé a intentar.",
        429,
        retryAfterHeaders(requestLimit)
      )
    };
  }

  const distributed = await distributedRateLimitRequest(request, {
    scope: `admin:${scope}`,
    limit,
    windowMs
  });
  if (!distributed.ok) {
    return {
      ok: false as const,
      response: jsonError(
        "Demasiadas solicitudes administrativas. Esperá un momento y volvé a intentar.",
        429,
        distributedRetryHeaders(distributed)
      )
    };
  }

  const profile = await getApiAdmin();
  if (!profile) return { ok: false as const, response: jsonError("No autorizado o falta verificar MFA.", 403) };

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false as const,
      response: jsonError(
        "El servicio administrativo no está disponible en este momento.",
        503,
        { "Cache-Control": "private, no-store, max-age=0, must-revalidate" }
      )
    };
  }

  return { ok: true as const, profile, admin };
}
