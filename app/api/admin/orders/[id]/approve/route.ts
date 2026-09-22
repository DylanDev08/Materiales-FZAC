import { withApiTelemetry } from "@/lib/observability/request";
import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

const paramsSchema = z.object({ id: z.string().uuid("Orden invalida.") });

async function handlePost(request: Request, context: { params: Promise<{ id: string }> }) {
  const mutation = validateJsonMutationRequest(request, 2 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await getAdminApiContext(request, { scope: "admin-order-approve", limit: 12 });
  if (!access.ok) return access.response;
  const { admin, profile } = access;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError(params.error.issues[0]?.message ?? "Orden invalida.", 422);

  const { data, error } = await admin.rpc("admin_transition_order", {
    p_order_id: params.data.id,
    p_action: "APPROVE",
    p_reason: "",
    p_actor_id: profile.id
  });

  if (error) {
    const detail = `${error.message ?? ""} ${error.details ?? ""}`;
    if (detail.includes("ORDER_NOT_FOUND")) return jsonError("Orden no encontrada.", 404);
    if (detail.includes("ORDER_NOT_AWAITING_APPROVAL")) {
      return jsonError("La orden no requiere aprobacion administrativa.", 422);
    }
    if (detail.includes("INSUFFICIENT_AVAILABLE_STOCK")) {
      return jsonError("No hay stock disponible suficiente para reservar esta compra. Revisá el pedido antes de aprobarlo.", 409);
    }
    if (error.code === "PGRST202" || detail.includes("admin_transition_order")) {
      return jsonError("La base necesita aplicar la migracion de integridad antes de aprobar pedidos.", 503);
    }
    return jsonError("No pudimos aprobar la orden.", 409);
  }

  const result = (data ?? {}) as { status?: string; reservation_expires_at?: string | null };
  return Response.json({
    ok: true,
    status: String(result.status ?? "PENDING_PAYMENT"),
    reservation_expires_at: result.reservation_expires_at ?? null,
    message: result.reservation_expires_at
      ? "Compra aprobada. El stock quedó reservado temporalmente para continuar el pago."
      : "Compra aprobada. Ya puede continuar el flujo de pago."
  });
}


export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiTelemetry("admin.order.approve", request, () => handlePost(request, context));
}
