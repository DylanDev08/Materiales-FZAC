import { z, ZodError } from "zod";
import { getApiAdmin } from "@/lib/auth/api-guards";
import {
  createMercadoPagoRefund,
  getMercadoPagoPayment,
  MercadoPagoRefundError
} from "@/lib/payments/mercadopago";
import { paymentLiveModeMatchesEnvironment } from "@/lib/payments/config";
import {
  assertRefundIntegrityReady,
  finalizeRefundedPayment,
  PaymentIntegrityRpcMissingError
} from "@/lib/payments/payment-service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

const paramsSchema = z.object({ id: z.string().uuid("Pago invalido.") });
const bodySchema = z.object({
  reason: z.enum([
    "PURCHASE_REGRET",
    "OUT_OF_STOCK",
    "ORDER_ERROR",
    "NOT_DELIVERED",
    "APPROVED_CLAIM",
    "OTHER"
  ]),
  details: z.string().trim().min(5, "Explica brevemente el motivo.").max(300, "El motivo es demasiado largo.")
});

const reasonLabels: Record<z.infer<typeof bodySchema>["reason"], string> = {
  PURCHASE_REGRET: "Arrepentimiento de compra",
  OUT_OF_STOCK: "Falta de stock",
  ORDER_ERROR: "Error en el pedido",
  NOT_DELIVERED: "Producto no entregado",
  APPROVED_CLAIM: "Reclamo aprobado",
  OTHER: "Otro"
};

function refundIdFromPayment(payment: Record<string, unknown>) {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
  const latest = refunds.at(-1);
  if (!latest || typeof latest !== "object") return null;
  const id = (latest as Record<string, unknown>).id;
  return id ? String(id) : null;
}

async function createRefundFailureNotification(paymentId: string, orderId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;
  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "REFUND_REJECTED",
    title: "Reembolso no procesado",
    message: `Revisa el pago ${paymentId.slice(0, 8).toUpperCase()} del pedido ${orderId.slice(0, 8).toUpperCase()}.`,
    link_to: `${getAdminConsolePath()}/pagos?order=${orderId}`
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const profile = await getApiAdmin();
  if (!profile) return jsonError("No autorizado.", 403);

  const limit = rateLimit(`${getRequestKey(request, "admin-refund")}:${profile.id}`, 4, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos de reembolso. Espera un minuto.", 429, retryAfterHeaders(limit));

  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("Backend administrativo no disponible.", 503);

  let providerRefundConfirmed = false;
  let affectedOrderId: string | null = null;

  try {
    const params = paramsSchema.parse(await context.params);
    const payload = bodySchema.parse(await request.json());
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select("id,order_id,provider,status,amount,provider_payment_id")
      .eq("id", params.id)
      .maybeSingle();

    if (paymentError) return jsonError("No pudimos revisar el pago.", 400);
    if (!payment) return jsonError("Pago no encontrado.", 404);
    if (payment.status === "REFUNDED") {
      return Response.json({ ok: true, alreadyRefunded: true, message: "Este pago ya fue reembolsado." });
    }
    if (payment.provider !== "MERCADOPAGO") return jsonError("Solo se pueden reembolsar pagos realizados con Mercado Pago.", 422);
    if (payment.status !== "PAID") return jsonError("Solo se pueden reembolsar pagos aprobados.", 422);
    if (!payment.provider_payment_id) return jsonError("El pago no tiene una referencia valida de Mercado Pago.", 422);

    const { data: order } = await admin
      .from("orders")
      .select("id,total,customer_name")
      .eq("id", payment.order_id)
      .maybeSingle();
    if (!order) return jsonError("No encontramos el pedido asociado.", 404);
    affectedOrderId = String(order.id);

    await assertRefundIntegrityReady();

    let providerPayment = await getMercadoPagoPayment(String(payment.provider_payment_id));
    const externalReference = String(providerPayment.external_reference ?? "");
    const providerAmount = Number(providerPayment.transaction_amount ?? payment.amount);
    if (externalReference !== String(order.id) || Math.abs(providerAmount - Number(payment.amount)) > 0.01) {
      return jsonError("El pago de Mercado Pago no coincide con el pedido seleccionado.", 409);
    }
    if (!paymentLiveModeMatchesEnvironment(providerPayment.live_mode)) {
      return jsonError("El pago pertenece a un ambiente diferente al configurado.", 409);
    }

    const reason = `${reasonLabels[payload.reason]}: ${payload.details}`;
    let providerRefundId = refundIdFromPayment(providerPayment);

    if (String(providerPayment.status) !== "refunded") {
      if (String(providerPayment.status) !== "approved") return jsonError("Mercado Pago no permite reembolsar este estado de pago.", 422);
      try {
        const refund = await createMercadoPagoRefund({
          providerPaymentId: String(payment.provider_payment_id),
          idempotencyKey: `fzac-refund-${payment.id}`
        });
        providerRefundId = refund.id;
        providerPayment = { ...providerPayment, refund: refund.raw, status: "refunded" };
      } catch (error) {
        if (error instanceof MercadoPagoRefundError && /already|4296/i.test(error.code)) {
          providerPayment = await getMercadoPagoPayment(String(payment.provider_payment_id));
          providerRefundId = refundIdFromPayment(providerPayment);
          if (String(providerPayment.status) !== "refunded") throw error;
        } else {
          throw error;
        }
      }
    }

    providerRefundConfirmed = String(providerPayment.status) === "refunded";

    await finalizeRefundedPayment({
      paymentId: String(payment.id),
      providerRefundId,
      raw: providerPayment,
      reason,
      actorId: profile.id,
      actorEmail: profile.email
    });

    return Response.json({
      ok: true,
      message: "Reembolso procesado correctamente. El stock y el comprobante fueron actualizados."
    });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Datos de reembolso invalidos.", 422);
    if (providerRefundConfirmed && affectedOrderId) {
      try {
        await admin.from("notifications").insert({
          target_role: "ADMIN",
          type: "REFUND_RECONCILIATION_REQUIRED",
          title: "Reembolso para conciliar",
          message: `Mercado Pago confirmo una devolucion para el pedido ${affectedOrderId.slice(0, 8).toUpperCase()}, pero falta actualizar la base.`,
          link_to: `${getAdminConsolePath()}/pagos?order=${affectedOrderId}`
        });
      } catch {
        // The API response still prevents a second refund attempt.
      }
      return Response.json(
        {
          ok: false,
          code: "REFUND_RECONCILIATION_REQUIRED",
          message: "Mercado Pago confirmo la devolucion. No la repitas: el pedido quedo marcado para conciliacion administrativa."
        },
        { status: 202 }
      );
    }
    if (error instanceof PaymentIntegrityRpcMissingError) {
      return jsonError("El reembolso esta bloqueado hasta aplicar la migracion segura de integridad en Supabase.", 503);
    }
    if (error instanceof MercadoPagoRefundError) {
      const params = paramsSchema.safeParse(await context.params);
      if (params.success) {
        const { data: payment } = await admin.from("payments").select("order_id").eq("id", params.data.id).maybeSingle();
        if (payment?.order_id) await createRefundFailureNotification(params.data.id, String(payment.order_id)).catch(() => undefined);
      }
      return jsonError("No pudimos procesar el reembolso. Revisa el estado y saldo disponible en Mercado Pago.", 502);
    }
    return jsonError("No pudimos completar el reembolso. No vuelvas a intentarlo hasta revisar el pago.", 500);
  }
}
