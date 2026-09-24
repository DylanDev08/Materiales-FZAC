import { ZodError } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { isAdminEmail } from "@/lib/auth/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { distributedRateLimitRequest, distributedRetryHeaders } from "@/lib/security/distributed-rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-reset-password"), 5, 60_000);
  const mutation = validateJsonMutationRequest(request, 4 * 1024);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera un minuto.", 429, retryAfterHeaders(limit));
  const distributed = await distributedRateLimitRequest(request, {
    scope: "auth-reset-password",
    limit: 5,
    windowMs: 60_000
  });
  if (!distributed.ok) {
    return jsonError("Demasiados intentos. Esperá un minuto.", 429, distributedRetryHeaders(distributed));
  }
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  try {
    const payload = resetPasswordSchema.parse(await request.json());
    const supabase = await getSupabaseServerClient();
    if (!supabase) return jsonError("La recuperacion no esta disponible en este momento.", 503);

    const { data: current, error: userError } = await supabase.auth.getUser();
    if (userError || !current.user) return jsonError("El enlace vencio o ya fue utilizado. Solicita uno nuevo.", 401);

    const { error } = await supabase.auth.updateUser({ password: payload.password });
    if (error) return jsonError("No pudimos actualizar la contraseña. Solicitá un enlace nuevo.", 400);

    if (isAdminEmail(current.user.email)) {
      const admin = getSupabaseAdminClient();
      if (admin) {
        await admin
          .from("admin_trusted_devices")
          .update({ revoked_at: new Date().toISOString() })
          .eq("user_id", current.user.id)
          .is("revoked_at", null);
      }
    }

    await supabase.auth.signOut({ scope: "global" });
    return Response.json({
      ok: true,
      target: "/login?password_updated=true",
      message: "Contraseña actualizada. Ya podés ingresar con tus nuevos datos."
    });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Contraseña inválida.", 422);
    return jsonError("No pudimos actualizar la contraseña.", 500);
  }
}
