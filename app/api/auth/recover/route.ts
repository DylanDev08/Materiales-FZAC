import { z, ZodError } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { normalizeEmail } from "@/lib/validations/auth";

const recoverSchema = z.object({
  email: z.string().trim().email("Ingresa un email valido.").transform(normalizeEmail)
});

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-recover"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429);

  try {
    const payload = recoverSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    if (!admin) return jsonError("No pudimos verificar la cuenta registrada.", 503);

    const { data: profile } = await admin.from("profiles").select("id").eq("email", payload.email).maybeSingle();
    if (!profile) return jsonError("No encontramos una cuenta registrada con ese email.", 404);

    const supabase = await getSupabaseServerClient();
    if (!supabase) return jsonError("La recuperacion no esta disponible en este momento.", 503);

    const origin = new URL(request.url).origin;
    const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
      redirectTo: `${origin}/login?reset=true`
    });

    if (error) return jsonError("No pudimos enviar el email de recuperacion.", 400);
    return Response.json({ ok: true, message: "Te enviamos el link de recuperacion a tu email." });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Email invalido.", 422);
    return jsonError("No pudimos iniciar la recuperacion.", 500);
  }
}
