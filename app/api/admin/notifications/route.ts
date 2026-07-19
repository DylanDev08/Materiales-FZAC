import { ZodError, z } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const patchSchema = z.object({
  id: z.string().uuid().optional(),
  markAll: z.boolean().optional()
}).refine((value) => value.markAll || value.id, "Selecciona una notificacion.");

export async function GET() {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const { data, error } = await admin
    .from("notifications")
    .select("id,type,title,message,link_to,read,created_at")
    .eq("target_role", "ADMIN")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return jsonError("No pudimos cargar notificaciones.", 400);
  return Response.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  let payload: z.infer<typeof patchSchema>;
  try {
    payload = patchSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos invalidos.", 422);
    return jsonError("No pudimos leer la notificacion.", 400);
  }

  const update = { read: true, read_at: new Date().toISOString() };
  const query = admin.from("notifications").update(update);
  const { error } = payload.markAll ? await query.eq("target_role", "ADMIN") : await query.eq("id", payload.id);
  if (error) return jsonError("No pudimos marcar la notificacion.", 400);

  return Response.json({ ok: true });
}
