import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { createSignupWithSender } from "@/lib/auth/email-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-register"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));

  try {
    const payload = registerSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();

    if (admin) {
      const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", payload.email).maybeSingle();
      if (existingProfile) return jsonError("Ya existe una cuenta con este email. Proba iniciar sesion.", 409);
    }

    let user = null;
    const senderSignup = await createSignupWithSender({
      email: payload.email,
      password: payload.password,
      name: payload.name,
      phone: payload.phone || null
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
          emailRedirectTo: `${getSiteUrl()}/auth/callback`
        }
      });

      if (error) {
        const duplicate = /already|registered|exists/i.test(error.message);
        return jsonError(
          duplicate ? "Ya existe una cuenta con este email. Proba iniciar sesion." : "No pudimos crear la cuenta. Revisa los datos e intenta nuevamente.",
          duplicate ? 409 : 400
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

    return Response.json({ target: "/login?registered=true", message: "Cuenta creada correctamente. Revisa tu email para confirmar el acceso." });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    if (error instanceof Error && /already|registered|exists/i.test(error.message)) {
      return jsonError("Ya existe una cuenta con este email. Proba iniciar sesion.", 409);
    }
    return jsonError("No pudimos crear la cuenta.", 500);
  }
}
