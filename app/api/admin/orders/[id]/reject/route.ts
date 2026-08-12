import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

const paramsSchema = z.object({ id: z.string().uuid("Orden invalida.") });
const bodySchema = z.object({
  reason: z.string().trim().min(3, "Indicá un motivo.").max(240)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const mutation = validateJsonMutationRequest(request, 4 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await getAdminApiContext(request, { scope: "admin-order-reject", limit: 12 });
  if (!access.ok) return access.response;
  const { admin, profile } = access;

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
      notes: `Rechazada por admin: ${body.data.reason}`,
      updated_at: new Date().toISOString()
    })
    .eq("id", order.id);

  if (updateError) return jsonError("No pudimos rechazar la orden.", 400);

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    actor_role: profile.role,
    action: "ORDER_REJECTED_BY_ADMIN",
    entity: "orders",
    entity_id: order.id,
    message: `Compra de ${order.customer_name} rechazada sin afectar stock.`,
    metadata: { previous_status: order.status, next_status: "CANCELLED", reason: body.data.reason, total: order.total }
  });

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "ORDER_REJECTED_BY_ADMIN",
    title: "Compra rechazada por admin",
    message: `${profile.email} rechazo la compra de ${order.customer_name}.`,
    link_to: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });

  return Response.json({ ok: true, status: "CANCELLED", message: "Compra rechazada. No se descuenta stock." });
}
