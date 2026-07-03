import { ZodError } from "zod";
import { isAdminEmail } from "@/lib/auth/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { loginSchema } from "@/lib/validations/auth";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-login"), 8, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Espera unos minutos.", 429);

  try {
    const payload = loginSchema.parse(await request.json());
    const supabase = await getSupabaseServerClient();
    if (!supabase) return jsonError("El ingreso no esta disponible en este momento.", 503);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email,
      password: payload.password
    });

    if (error || !data.user?.email) return jsonError("Email o contrasena incorrectos.", 401);

    return Response.json({ target: isAdminEmail(data.user.email) ? getAdminConsolePath() : "/cuenta" });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    return jsonError("No pudimos conectar con el servidor.", 500);
  }
}
