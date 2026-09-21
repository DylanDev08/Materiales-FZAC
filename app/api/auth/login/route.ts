import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { syncUserProfileOnLogin } from "@/lib/auth/get-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import {
  acquireRequestConcurrency,
  distributedRateLimit,
  distributedRateLimitIdentity,
  getRequestKey,
  retryAfterHeaders
} from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";
import { loginSchema } from "@/lib/validations/auth";

function loginErrorResponse(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`;
  if (/rate limit|too many|over_email_send_rate_limit/i.test(message)) {
    return jsonError("Hay demasiados intentos de ingreso en este momento. Esperá unos minutos y volvé a probar.", 429);
  }
  return Response.json(
    {
      ok: false,
      code: "AUTH_FAILED",
      message: "No pudimos iniciar sesión. Revisá tus datos o, si recién te registraste, confirmá tu email."
    },
    { status: 401 }
  );
}

export async function POST(request: Request) {
  const limit = await distributedRateLimit(getRequestKey(request, "auth-login"), 8, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);

  try {
    const payload = loginSchema.parse(body.data);
    const emailLimit = await distributedRateLimitIdentity("auth-login", payload.email, 6, 5 * 60_000);
    if (!emailLimit.ok) return jsonError("Demasiados intentos para esta cuenta. Esperá unos minutos.", 429, retryAfterHeaders(emailLimit));
    const slot = acquireRequestConcurrency(request, {
      scope: "auth-login",
      identity: payload.email,
      maxGlobal: 20,
      maxPerIp: 2,
      maxPerIdentity: 1,
      leaseMs: 15_000
    });
    if (!slot.ok) return jsonError("Ya estamos verificando este ingreso.", 429, retryAfterHeaders(slot));

    try {
      const supabase = await getSupabaseServerClient();
      if (!supabase) return jsonError("El ingreso no esta disponible en este momento.", 503);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: payload.email,
        password: payload.password
      });

      if (error || !data.user?.email) return loginErrorResponse(error);

      await syncUserProfileOnLogin(data.user);
      return Response.json({ target: isAdminEmail(data.user.email) ? getAdminConsolePath() : "/cuenta" });
    } finally {
      slot.release();
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return jsonError("No pudimos conectar con el servidor.", 500);
  }
}
