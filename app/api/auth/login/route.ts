import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { syncUserProfileOnLogin } from "@/lib/auth/get-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { loginSchema } from "@/lib/validations/auth";

function loginErrorResponse(error: { message?: string; code?: string } | null | undefined) {
  const message = `${error?.message ?? ""} ${error?.code ?? ""}`;
  if (/email.*not.*confirm|not.*confirm|email_not_confirmed/i.test(message)) {
    return jsonError(
      "Tu cuenta fue creada, pero falta confirmar el email. Revisá Gmail y abrí el enlace de Fortaleza Construcciones antes de iniciar sesión.",
      403
    );
  }
  if (/rate limit|too many|over_email_send_rate_limit/i.test(message)) {
    return jsonError("Hay demasiados intentos de email en este momento. Esperá unos minutos y volvé a probar.", 429);
  }
  return jsonError("No pudimos iniciar sesión. Revisá tus datos.", 401);
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-login"), 8, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));

  try {
    const payload = loginSchema.parse(await request.json());
    const supabase = await getSupabaseServerClient();
    if (!supabase) return jsonError("El ingreso no esta disponible en este momento.", 503);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (error || !data.user?.email) return loginErrorResponse(error);

    await syncUserProfileOnLogin(data.user);
    return Response.json({ target: isAdminEmail(data.user.email) ? getAdminConsolePath() : "/cuenta" });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    return jsonError("No pudimos conectar con el servidor.", 500);
  }
}
