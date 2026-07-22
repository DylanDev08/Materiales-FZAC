import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSignupWithSender } from "@/lib/auth/email-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

function authErrorMessage(message: string) {
  if (/password|character of each|uppercase|lowercase|0123456789|symbol/i.test(message)) {
    return "La contraseña debe tener mayúscula, minúscula, número y símbolo.";
  }
  if (/already|registered|exists/i.test(message)) {
    return "Ya existe una cuenta con este email. Probá iniciar sesión.";
  }
  return "No pudimos crear la cuenta. Revisá los datos e intentá nuevamente.";
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-register"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));

  try {
    const payload = registerSchema.parse(await request.json());
    const siteUrl = getRequestSiteUrl(request);
    const admin = getSupabaseAdminClient();

    if (admin) {
      const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", payload.email).maybeSingle();
      if (existingProfile) return jsonError("Ya existe una cuenta con este email. Probá iniciar sesión.", 409);
    }

    let user = null;
    const senderSignup = await createSignupWithSender({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      phone: payload.phone || null,
      siteUrl
    });

    if (senderSignup) {
      user = senderSignup.user;
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
        return jsonError(
          authErrorMessage(error.message),
          duplicate ? 409 : passwordPolicy ? 422 : 400
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

    return Response.json({ target: "/login?registered=true", message: "Cuenta creada correctamente. Revisá tu email para confirmar el acceso." });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    if (error instanceof Error && /already|registered|exists/i.test(error.message)) {
      return jsonError("Ya existe una cuenta con este email. Probá iniciar sesión.", 409);
    }
    if (error instanceof Error && /password|character of each|uppercase|lowercase|0123456789|symbol/i.test(error.message)) {
      return jsonError("La contraseña debe tener mayúscula, minúscula, número y símbolo.", 422);
    }
    return jsonError("No pudimos crear la cuenta.", 500);
  }
}
