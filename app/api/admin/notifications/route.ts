import { z } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const patchSchema = z.object({
  id: z.string().optional(),
  markAll: z.boolean().optional()
});

export async function GET() {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Supabase admin no esta configurado.", 500);

  const { data, error } = await admin
    .from("notifications")
    .select("*")
    .or("target_role.eq.ADMIN,user_id.is.null")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return jsonError("No pudimos cargar notificaciones.", 400);
  return Response.json({ notifications: data ?? [] });
}

export async function PATCH(request: Request) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 401);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Supabase admin no esta configurado.", 500);

  const payload = patchSchema.parse(await request.json());
  const update = { read: true, read_at: new Date().toISOString() };

  const query = admin.from("notifications").update(update);
  const { error } = payload.markAll ? await query.eq("target_role", "ADMIN") : await query.eq("id", payload.id);
  if (error) return jsonError("No pudimos marcar la notificacion.", 400);

  return Response.json({ ok: true });
}
