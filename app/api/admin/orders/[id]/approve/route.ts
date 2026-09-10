import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
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
    if (error.code === "PGRST202" || detail.includes("admin_transition_order")) {
      return jsonError("La base necesita aplicar la migracion de integridad antes de aprobar pedidos.", 503);
    }
    return jsonError("No pudimos aprobar la orden.", 409);
  }

  return Response.json({
    ok: true,
    status: String((data as { status?: string } | null)?.status ?? "PENDING_PAYMENT"),
    message: "Compra aprobada. Ya puede continuar el flujo de pago."
  });
}
