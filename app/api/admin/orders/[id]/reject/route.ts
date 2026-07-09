import { z } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";

const paramsSchema = z.object({ id: z.string().uuid("Orden invalida.") });
const bodySchema = z.object({
  reason: z.string().trim().max(240).optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 403);

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 500);

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError(params.error.issues[0]?.message ?? "Orden invalida.", 422);

  const body = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return jsonError("Motivo invalido.", 422);

  const { data: order, error } = await admin
    .from("orders")
    .select("id,status,customer_name,total")
    .eq("id", params.data.id)
    .maybeSingle();

  if (error) return jsonError("No pudimos cargar la orden.", 400);
  if (!order) return jsonError("Orden no encontrada.", 404);
  if (order.status === "PAID") return jsonError("No se rechaza una orden pagada sin revision manual.", 422);
  if (order.status === "CANCELLED") return jsonError("La orden ya esta cancelada.", 422);

  const { error: updateError } = await admin
    .from("orders")
    .update({
      status: "CANCELLED",
      notes: body.data.reason ? `Rechazada por admin: ${body.data.reason}` : "Rechazada por admin.",
      updated_at: new Date().toISOString()
    })
    .eq("id", order.id);

  if (updateError) return jsonError("No pudimos rechazar la orden.", 400);

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "ORDER_REJECTED_BY_ADMIN",
    title: "Compra rechazada por admin",
    message: `${profile.email} rechazo la compra de ${order.customer_name}.`,
    link_to: `/admin/pedidos?order=${order.id}`
  });

  return Response.json({ ok: true, status: "CANCELLED", message: "Compra rechazada. No se descuenta stock." });
}
