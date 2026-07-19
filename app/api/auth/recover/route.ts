import { z, ZodError } from "zod";
import { requestPasswordRecoveryEmail } from "@/lib/auth/email-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { normalizeEmail } from "@/lib/validations/auth";

const recoverSchema = z.object({
  email: z.string().trim().email("Ingresa un email valido.").transform(normalizeEmail)
});

const genericMessage = "Si existe una cuenta con ese email, vas a recibir un link de recuperacion.";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-recover"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429, retryAfterHeaders(limit));

  try {
    const payload = recoverSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    if (!admin) return Response.json({ ok: true, message: genericMessage });

    const { data: profile } = await admin.from("profiles").select("id,full_name").eq("email", payload.email).maybeSingle();
    if (!profile) return Response.json({ ok: true, message: genericMessage });

    await requestPasswordRecoveryEmail({ email: payload.email, name: profile.full_name }).catch(() => undefined);
    return Response.json({ ok: true, message: genericMessage });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Email invalido.", 422);
    return jsonError("No pudimos iniciar la recuperacion.", 500);
  }
}
