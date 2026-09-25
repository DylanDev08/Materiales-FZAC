import { NextResponse } from "next/server";
import { createOAuthLegalIntent, OAUTH_LEGAL_INTENT_COOKIE } from "@/lib/legal/oauth-intent";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { isTrustedMutationRequest } from "@/lib/utils/request-security";

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) {
    return NextResponse.json({ ok: false, message: "Origen de solicitud no permitido." }, { status: 403 });
  }
  const limit = rateLimit(getRequestKey(request, "oauth-legal-intent"), 8, 10 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, message: "Demasiados intentos. Espera unos minutos." },
      { status: 429, headers: retryAfterHeaders(limit) }
    );
  }
  const intent = createOAuthLegalIntent();
  if (!intent) {
    return NextResponse.json({ ok: false, message: "No pudimos preparar el registro con Google." }, { status: 503 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  response.cookies.set(OAUTH_LEGAL_INTENT_COOKIE, intent, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60
  });
  return response;
}
