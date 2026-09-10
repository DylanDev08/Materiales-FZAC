import { z } from "zod";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { jsonError } from "@/lib/utils/api";
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

  const { data, error } = await admin.rpc("admin_transition_order", {
    p_order_id: params.data.id,
    p_action: "REJECT",
    p_reason: body.data.reason,
    p_actor_id: profile.id
  });

  if (error) {
    const detail = `${error.message ?? ""} ${error.details ?? ""}`;
    if (detail.includes("ORDER_NOT_FOUND")) return jsonError("Orden no encontrada.", 404);
    if (detail.includes("PAYMENT_ALREADY_STARTED")) {
      return jsonError("El pago ya fue iniciado. Revisalo desde Pagos antes de cancelar el pedido.", 409);
    }
    if (detail.includes("ORDER_CANNOT_BE_REJECTED")) {
      return jsonError("La orden ya no se puede rechazar en su estado actual.", 422);
    }
    if (error.code === "PGRST202" || detail.includes("admin_transition_order")) {
      return jsonError("La base necesita aplicar la migracion de integridad antes de rechazar pedidos.", 503);
    }
    return jsonError("No pudimos rechazar la orden.", 409);
  }

  return Response.json({
    ok: true,
    status: String((data as { status?: string } | null)?.status ?? "CANCELLED"),
    message: "Compra rechazada. No se descuenta stock."
  });
}
