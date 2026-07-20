import { ZodError } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { resetPasswordSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-reset-password"), 5, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera un minuto.", 429, retryAfterHeaders(limit));

  try {
    const payload = resetPasswordSchema.parse(await request.json());
    const supabase = await getSupabaseServerClient();
    if (!supabase) return jsonError("La recuperacion no esta disponible en este momento.", 503);

    const { data: current, error: userError } = await supabase.auth.getUser();
    if (userError || !current.user) return jsonError("El enlace vencio o ya fue utilizado. Solicita uno nuevo.", 401);

    const { error } = await supabase.auth.updateUser({ password: payload.password });
    if (error) return jsonError("No pudimos actualizar la contraseña. Solicitá un enlace nuevo.", 400);

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
