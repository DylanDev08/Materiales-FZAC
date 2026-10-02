import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { purchaseConfirmationEmailTemplate } from "@/lib/email/templates";
import { getPublicSiteUrl } from "@/lib/seo/site";
import { notifyAdminFulfillmentRequired, notifyAdminPaymentApproved } from "@/lib/notifications/admin-notifier";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import type { PaymentProvider, PaymentStatus } from "@/types/domain";

type ConfirmationInput = {
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  raw?: Record<string, unknown> | null;
  status?: PaymentStatus;
};

type FailureConfirmationInput = {
  orderId: string;
  providerPaymentId?: string | null;
  raw?: Record<string, unknown> | null;
  paymentStatus: "FAILED" | "EXPIRED";
  providerStatus?: string | null;
};

type RefundConfirmationInput = {
  paymentId: string;
  providerRefundId?: string | null;
  raw?: Record<string, unknown> | null;
  reason: string;
  actorId: string | null;
  actorEmail: string;
};

export class PaymentIntegrityRpcMissingError extends Error {
  code = "PAYMENT_INTEGRITY_RPC_MISSING";

  constructor() {
    super("La base de datos todavia no tiene aplicada la migracion de integridad de pagos.");
    this.name = "PaymentIntegrityRpcMissingError";
  }
}

function isMissingRpcError(error: { code?: string; message?: string }, functionName: string) {
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "PGRST202" || message.includes(functionName.toLowerCase()) || message.includes("could not find the function");
}

export async function assertRefundIntegrityReady() {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para registrar reembolsos.");

  const { error } = await admin.rpc("finalize_refunded_order", {
    p_payment_id: "00000000-0000-0000-0000-000000000000",
    p_provider_refund_id: null,
    p_raw: {},
    p_reason: "Verificacion de integridad",
    p_actor_id: null,
    p_actor_email: "system"
  });

  if (!error || String(error.message ?? "").includes("PAYMENT_NOT_FOUND")) return;
  if (isMissingRpcError(error, "finalize_refunded_order")) throw new PaymentIntegrityRpcMissingError();
  throw new Error("No pudimos validar la integridad de reembolsos en la base de datos.");
}

export async function confirmApprovedPayment(input: ConfirmationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para confirmar pagos reales.");
  if (input.status && input.status !== "PAID") throw new Error("El pago no esta aprobado para finalizar la orden.");

  const { data, error } = await admin.rpc("finalize_paid_order", {
    p_order_id: input.orderId,
    p_provider_payment_id: input.providerPaymentId ?? null,
    p_raw: input.raw ?? {}
  });

  if (error) {
    if (isMissingRpcError(error, "finalize_paid_order")) throw new PaymentIntegrityRpcMissingError();
    throw new Error("No pudimos finalizar la orden aprobada de forma atomica.");
  }

  try {
    const [{ data: order }, { data: ticket }, { data: items }] = await Promise.all([
      admin
        .from("orders")
        .select("id,user_id,status,customer_name,customer_email,customer_phone,total,shipping_method,shipping_cost,address_snapshot")
        .eq("id", input.orderId)
        .maybeSingle(),
      admin
        .from("purchase_tickets")
        .select("number,payment_provider")
        .eq("order_id", input.orderId)
        .maybeSingle(),
      admin
        .from("order_items")
        .select("name,quantity,unit_price,subtotal")
        .eq("order_id", input.orderId)
        .order("created_at", { ascending: true })
    ]);

    if (order && String(order.status) === "PAID") {
      const now = new Date().toISOString();
      const customerMessage = String(order.shipping_method ?? "PICKUP") === "DELIVERY"
        ? `FZAC: pago confirmado. Tu pedido ${input.orderId.slice(0, 8).toUpperCase()} ya está en preparación para despacho.`
        : `FZAC: pago confirmado. Tu pedido ${input.orderId.slice(0, 8).toUpperCase()} ya está en preparación. Te avisaremos cuando esté listo para retirar.`;

      let whatsappStatus: "NOT_REQUESTED" | "DRY_RUN" | "SENT" | "FAILED" = "NOT_REQUESTED";
      let providerMessageId: string | null = null;

      if (order.customer_phone) {
        const sent = await sendWhatsAppText(String(order.customer_phone), customerMessage)
          .catch(() => ({ status: "FAILED" as const, providerMessageId: null }));
        whatsappStatus = sent.status;
        providerMessageId = sent.providerMessageId;
      }

      const { data: prepared } = await admin
        .from("orders")
        .update({ status: "PREPARING", status_updated_at: now, updated_at: now })
        .eq("id", input.orderId)
        .eq("status", "PAID")
        .select("id")
        .maybeSingle();

      if (prepared?.id) {
        await admin.from("order_status_events").insert({
          order_id: input.orderId,
          from_status: "PAID",
          to_status: "PREPARING",
          note: "Pago aprobado. Pedido enviado automáticamente a preparación.",
          actor_id: null,
          customer_visible: true,
          whatsapp_status: whatsappStatus,
          whatsapp_provider_message_id: providerMessageId
        });

        if (order.user_id) {
          await admin.from("notifications").insert({
            user_id: order.user_id,
            type: "ORDER_STATUS_UPDATED",
            title: "Tu pedido está en preparación",
            message: customerMessage,
            link_to: "/cuenta/pedidos"
          });
        }
      }
    }

    if (order?.customer_email && ticket?.number) {
      const address = order.address_snapshot && typeof order.address_snapshot === "object"
        ? [
            (order.address_snapshot as Record<string, unknown>).street,
            (order.address_snapshot as Record<string, unknown>).number,
            (order.address_snapshot as Record<string, unknown>).city,
            (order.address_snapshot as Record<string, unknown>).province
          ].filter(Boolean).join(" ")
        : "";

      const template = purchaseConfirmationEmailTemplate({
        customerName: String(order.customer_name ?? "cliente"),
        ticketNumber: String(ticket.number),
        orderReference: input.orderId.slice(0, 8).toUpperCase(),
        total: Number(order.total ?? 0),
        shippingCost: Number(order.shipping_cost ?? 0),
        paymentProvider: String(ticket.payment_provider ?? input.provider),
        shippingMethod: String(order.shipping_method ?? "PICKUP") === "DELIVERY" ? "DELIVERY" : "PICKUP",
        deliveryAddress: address || undefined,
        items: (items ?? []).map((item) => ({
          name: String(item.name ?? "Producto"),
          quantity: Number(item.quantity ?? 0),
          unitPrice: Number(item.unit_price ?? 0),
          subtotal: Number(item.subtotal ?? 0)
        })),
        actionUrl: `${getPublicSiteUrl()}/cuenta/pedidos`
      });

      await sendTransactionalEmail({
        to: { email: String(order.customer_email), name: String(order.customer_name ?? "") },
        subject: template.subject,
        html: template.html,
        text: template.text,
        idempotencyKey: `fzac-order-paid-${input.orderId}`
      }).catch(() => undefined);
    }

    if (order) {
      await Promise.all([
        notifyAdminPaymentApproved({
          id: input.orderId,
          customerName: String(order.customer_name ?? "Cliente"),
          ticketNumber: ticket?.number ? String(ticket.number) : undefined,
          total: Number(order.total ?? 0)
        }).catch(() => undefined),
        notifyAdminFulfillmentRequired({
          id: input.orderId,
          customerName: String(order.customer_name ?? "Cliente"),
          customerPhone: order.customer_phone ? String(order.customer_phone) : null,
          shippingMethod: String(order.shipping_method ?? "PICKUP"),
          shippingCost: Number(order.shipping_cost ?? 0),
          address: order.address_snapshot && typeof order.address_snapshot === "object"
            ? order.address_snapshot as Record<string, unknown>
            : null,
          ticketNumber: ticket?.number ? String(ticket.number) : undefined
        }).catch(() => undefined)
      ]);
    }
  } catch {
    // Email, WhatsApp y notificaciones son best-effort: nunca deben revertir una confirmación de pago.
  }

  return { ok: true, source: "rpc", result: data };
}

export async function finalizeFailedPayment(input: FailureConfirmationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para cerrar pagos fallidos.");

  const { data, error } = await admin.rpc("finalize_failed_order", {
    p_order_id: input.orderId,
    p_provider_payment_id: input.providerPaymentId ?? null,
    p_raw: input.raw ?? {},
    p_payment_status: input.paymentStatus,
    p_provider_status: input.providerStatus ?? input.paymentStatus
  });

  if (error) {
    if (isMissingRpcError(error, "finalize_failed_order")) throw new PaymentIntegrityRpcMissingError();
    throw new Error("No pudimos cerrar el pago fallido de forma atomica.");
  }

  return { ok: true, source: "rpc", result: data };
}

export async function finalizeRefundedPayment(input: RefundConfirmationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para registrar reembolsos.");

  const { data, error } = await admin.rpc("finalize_refunded_order", {
    p_payment_id: input.paymentId,
    p_provider_refund_id: input.providerRefundId ?? null,
    p_raw: input.raw ?? {},
    p_reason: input.reason,
    p_actor_id: input.actorId,
    p_actor_email: input.actorEmail
  });

  if (error) {
    if (isMissingRpcError(error, "finalize_refunded_order")) throw new PaymentIntegrityRpcMissingError();
    throw new Error("Mercado Pago confirmo el reembolso, pero no pudimos actualizar la orden de forma atomica.");
  }

  return { ok: true, source: "rpc", result: data };
}
