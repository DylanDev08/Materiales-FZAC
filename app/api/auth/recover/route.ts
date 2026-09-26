import { z, ZodError } from "zod";
import { requestPasswordRecoveryEmail } from "@/lib/auth/email-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { distributedRateLimitRequest, distributedRetryHeaders } from "@/lib/security/distributed-rate-limit";
import { normalizeEmail } from "@/lib/validations/auth";
import { verifyTurnstileToken } from "@/lib/security/turnstile";

const recoverSchema = z.object({
  email: z.string().trim().email("Ingresa un email válido.").transform(normalizeEmail),
  captchaToken: z.string().max(4096).optional()
});

const genericMessage = "Si existe una cuenta con ese email, vas a recibir un link de recuperación de Materiales FZAC.";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-recover"), 5, 60_000);
  const mutation = validateJsonMutationRequest(request, 2 * 1024);
  if (!limit.ok) return jsonError("Demasiados intentos. Esperá unos minutos.", 429, retryAfterHeaders(limit));
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  try {
    const payload = recoverSchema.parse(await request.json());
    const captcha = await verifyTurnstileToken(payload.captchaToken, "recover");
    if (!captcha.ok) {
      return jsonError(
        captcha.unavailable ? "La verificación anti-bot no está disponible. Reintentá en un momento." : "Completá la verificación anti-bot.",
        captcha.unavailable ? 503 : 403
      );
    }
    const distributed = await distributedRateLimitRequest(request, {
      scope: "auth-recover",
      limit: 5,
      windowMs: 60_000,
      identity: payload.email,
      identityLimit: 3,
      identityWindowMs: 30 * 60_000
    });
    if (!distributed.ok) {
      return jsonError("Demasiadas solicitudes. Esperá unos minutos.", 429, distributedRetryHeaders(distributed));
    }
    const admin = getSupabaseAdminClient();
    if (!admin) return Response.json({ ok: true, message: genericMessage });

    const { data: profile } = await admin.from("profiles").select("id,full_name").eq("email", payload.email).maybeSingle();
    if (!profile) return Response.json({ ok: true, message: genericMessage });

    await requestPasswordRecoveryEmail({ email: payload.email, name: profile.full_name, siteUrl: getRequestSiteUrl(request) }).catch(() => undefined);
    return Response.json({ ok: true, message: genericMessage });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Email inválido.", 422);
    return jsonError("No pudimos iniciar la recuperación.", 500);
  }
}
