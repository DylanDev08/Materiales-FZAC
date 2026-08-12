import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

const paramsSchema = z.object({ id: z.string().uuid("Orden invalida.") });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const mutation = validateJsonMutationRequest(request, 2 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await getAdminApiContext(request, { scope: "admin-order-approve", limit: 12 });
  if (!access.ok) return access.response;
  const { admin, profile } = access;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError(params.error.issues[0]?.message ?? "Orden invalida.", 422);

  const { data: order, error } = await admin
    .from("orders")
    .select("id,status,customer_name,total")
    .eq("id", params.data.id)
    .maybeSingle();

  if (error) return jsonError("No pudimos cargar la orden.", 400);
  if (!order) return jsonError("Orden no encontrada.", 404);
  if (order.status === "CANCELLED") return jsonError("No se puede aprobar una orden cancelada.", 422);
  if (order.status !== "PENDING_ADMIN_APPROVAL") return jsonError("La orden no requiere aprobacion administrativa.", 422);

  const { error: updateError } = await admin
    .from("orders")
    .update({ status: "PENDING_PAYMENT", updated_at: new Date().toISOString() })
    .eq("id", order.id);

  if (updateError) return jsonError("No pudimos aprobar la orden.", 400);

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    actor_role: profile.role,
    action: "ORDER_APPROVED_BY_ADMIN",
    entity: "orders",
    entity_id: order.id,
    message: `Compra de ${order.customer_name} aprobada para continuar el pago.`,
    metadata: { previous_status: order.status, next_status: "PENDING_PAYMENT", total: order.total }
  });

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "ORDER_APPROVED_BY_ADMIN",
    title: "Compra aprobada por admin",
    message: `${profile.email} aprobo la compra de ${order.customer_name}.`,
    link_to: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });

  return Response.json({ ok: true, status: "PENDING_PAYMENT", message: "Compra aprobada. Ya puede continuar el flujo de pago." });
}
