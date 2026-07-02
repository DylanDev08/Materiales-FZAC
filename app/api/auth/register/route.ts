import { ZodError } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-register"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429);

  try {
    const payload = registerSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();

    if (admin) {
      const { data: existingProfile } = await admin.from("profiles").select("id").eq("email", payload.email).maybeSingle();
      if (existingProfile) return jsonError("Ya existe una cuenta con ese email. Inicia sesion.", 409);
    }

    const supabase = await getSupabaseServerClient();
    if (!supabase) return jsonError("Supabase no esta configurado.", 503);

    const { error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: { full_name: payload.name, phone: payload.phone || null },
        emailRedirectTo: `${new URL(request.url).origin}/auth/callback`
      }
    });

    if (error) {
      const duplicate = /already|registered|exists/i.test(error.message);
      return jsonError(duplicate ? "Ya existe una cuenta con ese email. Inicia sesion." : error.message, duplicate ? 409 : 400);
    }

    return Response.json({ target: "/login?registered=true" });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    return jsonError("No pudimos crear la cuenta.", 500);
  }
}
