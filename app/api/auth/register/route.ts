import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSignupWithResend } from "@/lib/auth/email-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

function authErrorMessage(message: string) {
  if (/rate limit|too many|over_email_send_rate_limit/i.test(message)) {
    return "No pudimos enviar el email de confirmación por límite temporal. Esperá unos minutos y volvé a probar.";
  }
  if (/password|character of each|uppercase|lowercase|0123456789|symbol/i.test(message)) {
    return "La contraseña debe tener mayúscula, minúscula, número y símbolo.";
  }
  return "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.";
}

const genericRegistrationMessage =
  "Si el email puede registrarse, vas a recibir un enlace de Fortaleza Construcciones para confirmar el acceso.";

function genericRegistrationResponse() {
  return Response.json({ target: "/login?registered=true", message: genericRegistrationMessage });
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-register"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));

  try {
    const payload = registerSchema.parse(await request.json());
    const siteUrl = getRequestSiteUrl(request);
    const admin = getSupabaseAdminClient();

    let user = null;
    const resendSignup = await createSignupWithResend({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      phone: payload.phone || null,
      siteUrl
    });

    if (resendSignup) {
      user = resendSignup.user;
    } else {
      const supabase = await getSupabaseServerClient();
      if (!supabase) return jsonError("El registro no esta disponible en este momento.", 503);

      const { data, error } = await supabase.auth.signUp({
        email: payload.email,
        password: payload.password,
        options: {
          data: { full_name: payload.name, phone: payload.phone || null },
          emailRedirectTo: `${siteUrl}/auth/callback`
        }
      });

      if (error) {
        const duplicate = /already|registered|exists/i.test(error.message);
        const passwordPolicy = /password|character of each|uppercase|lowercase|0123456789|symbol/i.test(error.message);
        const emailRateLimit = /rate limit|too many|over_email_send_rate_limit/i.test(error.message);
        if (duplicate) return genericRegistrationResponse();
        return jsonError(
          authErrorMessage(error.message),
          passwordPolicy ? 422 : emailRateLimit ? 429 : 400
        );
      }
      user = data.user;
    }

    if (admin && user?.id && isAdminEmail(payload.email)) {
      await admin.from("profiles").upsert(
        {
          id: user.id,
          email: payload.email,
          full_name: payload.name,
          phone: payload.phone || null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
          role: "ADMIN",
          updated_at: new Date().toISOString()
        },
        { onConflict: "id" }
      );
    }

    return genericRegistrationResponse();
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    if (error instanceof Error && /already|registered|exists/i.test(error.message)) {
      return genericRegistrationResponse();
    }
    if (error instanceof Error && /password|character of each|uppercase|lowercase|0123456789|symbol/i.test(error.message)) {
      return jsonError("La contraseña debe tener mayúscula, minúscula, número y símbolo.", 422);
    }
    if (error instanceof Error && /rate limit|too many|over_email_send_rate_limit/i.test(error.message)) {
      return jsonError("No pudimos enviar el email de confirmación por límite temporal. Esperá unos minutos y volvé a probar.", 429);
    }
    return jsonError("No pudimos crear la cuenta.", 500);
  }
}
