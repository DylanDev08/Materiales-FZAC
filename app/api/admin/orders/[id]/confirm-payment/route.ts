import { z } from "zod";
import { withApiTelemetry } from "@/lib/observability/request";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { confirmApprovedPayment } from "@/lib/payments/payment-service";
import { ensureSupplierPurchaseOrdersForCustomerOrder } from "@/lib/procurement/from-customer-order";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

const paramsSchema = z.object({ id: z.string().uuid("Orden invalida.") });

async function handlePost(request: Request, context: { params: Promise<{ id: string }> }) {
  const mutation = validateJsonMutationRequest(request, 4 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  const access = await getAdminApiContext(request, { scope: "admin-order-confirm-payment", limit: 12 });
  if (!access.ok) return access.response;
  const { admin, profile } = access;

  const params = paramsSchema.safeParse(await context.params);
  if (!params.success) return jsonError(params.error.issues[0]?.message ?? "Orden invalida.", 422);
  const orderId = params.data.id;

  const [{ data: order, error: orderError }, { data: payment, error: paymentError }] = await Promise.all([
    admin.from("orders").select("id,status,total,customer_name").eq("id", orderId).maybeSingle(),
    admin.from("payments").select("id,status,provider,raw").eq("order_id", orderId).maybeSingle()
  ]);

  if (orderError || !order) return jsonError("Orden no encontrada.", 404);
  if (paymentError || !payment) return jsonError("El pedido no tiene un registro de pago para confirmar.", 409);
  if (String(order.status) === "CANCELLED") return jsonError("No se puede confirmar el pago de una orden cancelada.", 409);

  const confirmedAt = new Date().toISOString();
  const existingRaw = payment.raw && typeof payment.raw === "object" ? payment.raw as Record<string, unknown> : {};
  const manualRaw = {
    ...existingRaw,
    checkout_provider: payment.provider,
    manual_transfer_confirmation: true,
    confirmed_by: profile.id,
    confirmed_at: confirmedAt
  };

  const { error: providerUpdateError } = await admin
    .from("payments")
    .update({ provider: "BANK_TRANSFER", raw: manualRaw, updated_at: confirmedAt })
    .eq("id", payment.id);
  if (providerUpdateError) return jsonError("No pudimos preparar el registro de transferencia.", 409);

  try {
    await confirmApprovedPayment({
      orderId,
      provider: "BANK_TRANSFER",
      status: "PAID",
      raw: manualRaw
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pudimos confirmar el pago.";
    if (message.includes("stock") || message.includes("orden aprobada")) {
      return jsonError("No pudimos confirmar el pago porque el stock del pedido cambió. Revisá el pedido antes de continuar.", 409);
    }
    return jsonError(message, 409);
  }

  await admin
    .from("whatsapp_payment_proofs")
    .update({ status: "ACCEPTED", reviewed_at: confirmedAt, reviewed_by: profile.id })
    .eq("order_id", orderId)
    .eq("status", "PENDING_REVIEW");

  try {
    const procurement = await ensureSupplierPurchaseOrdersForCustomerOrder(orderId, profile.id);
    return Response.json({
      ok: true,
      payment: "PAID",
      procurement,
      message: procurement.purchaseOrders.length
        ? `Pago confirmado. Se generaron ${procurement.purchaseOrders.length} orden(es) de compra en borrador para revisar en Compras.`
        : "Pago confirmado. El pedido no requirió generar órdenes de compra nuevas."
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No pudimos generar las órdenes a proveedores.";
    return Response.json({
      ok: true,
      payment: "PAID",
      procurement: { ok: false, warning: detail },
      message: `Pago confirmado. Atención: ${detail} Revisá Compras antes de preparar el pedido.`
    });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return withApiTelemetry("admin.order.confirm-payment", request, () => handlePost(request, context));
}
