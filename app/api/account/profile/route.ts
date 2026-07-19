import { ZodError, z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { hasSqlMeta } from "@/lib/validations/security";

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Ingresa tu nombre completo.")
    .max(120, "El nombre es demasiado largo.")
    .refine((value) => !hasSqlMeta(value), "El nombre contiene caracteres no permitidos."),
  phone: z
    .string()
    .trim()
    .min(6, "Ingresa un telefono valido.")
    .max(40, "El telefono es demasiado largo.")
    .refine((value) => !hasSqlMeta(value), "El telefono contiene caracteres no permitidos."),
  avatar_url: z
    .string()
    .trim()
    .max(500, "La URL de foto es demasiado larga.")
    .url("Ingresa una URL valida.")
    .optional()
    .or(z.literal(""))
});

export async function PATCH(request: Request) {
  const limit = rateLimit(getRequestKey(request, "account-profile"), 20, 60_000);
  if (!limit.ok) return jsonError("Demasiadas actualizaciones. Proba nuevamente en un minuto.", 429, retryAfterHeaders(limit));

  try {
    const user = await getCurrentUser();
    if (!user?.email) return jsonError("Necesitas iniciar sesion.", 401);

    const payload = profileSchema.parse(await request.json());
    const admin = getSupabaseAdminClient();
    if (!admin) return jsonError("No pudimos guardar tus datos en este momento.", 503);

    const { error } = await admin.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: payload.full_name,
        phone: payload.phone,
        avatar_url: payload.avatar_url || null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "id" }
    );

    if (error) return jsonError("No pudimos guardar tus datos.", 400);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    return jsonError("No pudimos actualizar la cuenta.", 500);
  }
}
