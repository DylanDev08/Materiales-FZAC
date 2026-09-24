import { getUserProfile } from "@/lib/auth/get-user";
import { hasAdminAal2 } from "@/lib/auth/admin-mfa";
import {
  createTrustedAdminDevice,
  revokeCurrentTrustedAdminDevice
} from "@/lib/auth/trusted-device";
import { jsonError } from "@/lib/utils/api";
import { isTrustedMutationRequest } from "@/lib/utils/request-security";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function requireAdminIdentityOnly() {
  const profile = await getUserProfile();
  return profile?.role === "ADMIN" ? profile : null;
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);
  const limit = rateLimit(getRequestKey(request, "admin-trusted-device-create"), 6, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Esperá un momento.", 429, retryAfterHeaders(limit));

  const profile = await requireAdminIdentityOnly();
  if (!profile) return jsonError("No autorizado.", 403);

  // Crear confianza requiere una verificación TOTP real en la sesión actual.
  // Un dispositivo ya recordado nunca puede crear otro sin volver a AAL2.
  if (!(await hasAdminAal2())) return jsonError("Verificá el autenticador antes de confiar en este dispositivo.", 403);

  const created = await createTrustedAdminDevice();
  if (!created) return jsonError("No pudimos recordar este dispositivo. Podés continuar usando MFA normalmente.", 503);

  return Response.json(
    { ok: true, trustedForDays: 14 },
    { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } }
  );
}

export async function DELETE(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);
  const profile = await requireAdminIdentityOnly();
  if (!profile) return jsonError("No autorizado.", 403);

  await revokeCurrentTrustedAdminDevice();
  return Response.json(
    { ok: true },
    { headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" } }
  );
}
