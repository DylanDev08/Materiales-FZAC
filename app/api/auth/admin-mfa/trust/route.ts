import { NextResponse } from "next/server";
import { hasAdminAal2 } from "@/lib/auth/admin-mfa";
import {
  ADMIN_TRUST_COOKIE,
  ADMIN_TRUST_MAX_AGE_SECONDS,
  createTrustedAdminDevice,
  revokeCurrentTrustedAdminDevice
} from "@/lib/auth/admin-trusted-device";
import { getUserProfile } from "@/lib/auth/get-user";
import { jsonError } from "@/lib/utils/api";
import { readLimitedJson, isTrustedMutationRequest } from "@/lib/utils/request-security";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return jsonError("Origen de solicitud no permitido.", 403);

  const profile = await getUserProfile();
  if (!profile || profile.role !== "ADMIN") return jsonError("No autorizado.", 403);
  if (!(await hasAdminAal2())) return jsonError("Verificá MFA antes de confiar este navegador.", 403);

  const body = await readLimitedJson(request, 1024);
  if (!body.ok) return jsonError(body.message, body.status);
  const remember = Boolean((body.data as { remember?: unknown } | null)?.remember);

  if (!remember) {
    await revokeCurrentTrustedAdminDevice(profile.id);
    const response = NextResponse.json({ ok: true, trusted: false });
    response.cookies.set({
      name: ADMIN_TRUST_COOKIE,
      value: "",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
    return response;
  }

  try {
    const trusted = await createTrustedAdminDevice(profile.id, request.headers.get("user-agent"));
    const response = NextResponse.json({ ok: true, trusted: true, expiresAt: trusted.expiresAt });
    response.cookies.set({
      name: ADMIN_TRUST_COOKIE,
      value: trusted.token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_TRUST_MAX_AGE_SECONDS
    });
    return response;
  } catch {
    return jsonError("No pudimos guardar este navegador como confiable. MFA sigue activo para esta sesión.", 503);
  }
}
