import type { OrderStatus, PaymentStatus } from "@/types/domain";

export type MercadoPagoWebhookAction = "CONFIRM" | "REFUND" | "MANUAL_REVIEW" | "UPDATE";

export function isMercadoPagoPaymentId(value: string) {
  return /^\d{1,32}$/.test(value.trim());
}

export function mercadoPagoWebhookAction(status: string): MercadoPagoWebhookAction {
  if (status === "approved") return "CONFIRM";
  if (status === "partially_refunded") return "MANUAL_REVIEW";
  if (status === "refunded" || status === "charged_back") return "REFUND";
  return "UPDATE";
}

export function paymentStatusFromMercadoPago(status: string): PaymentStatus {
  if (status === "approved") return "PAID";
  if (status === "rejected" || status === "cancelled") return "FAILED";
  if (status === "refunded" || status === "charged_back") return "REFUNDED";
  if (status === "expired") return "EXPIRED";
  return "PENDING";
}

export function orderStatusFromMercadoPago(status: string): OrderStatus {
  if (["cancelled", "expired", "refunded", "charged_back"].includes(status)) return "CANCELLED";
  return "PENDING_PAYMENT";
}

export function providerRefundId(payment: Record<string, unknown>) {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
  const latest = refunds.at(-1);
  if (!latest || typeof latest !== "object") return null;
  const id = (latest as Record<string, unknown>).id;
  return id ? String(id) : null;
}

export function paymentAmountMatchesLocal(
  payment: Record<string, unknown>,
  localPayment: { amount?: string | number | null; currency?: string | null }
) {
  const remoteAmount = Number(payment.transaction_amount);
  const localAmount = Number(localPayment.amount);
  const remoteCurrency = String(payment.currency_id ?? "").trim().toUpperCase();
  const localCurrency = String(localPayment.currency ?? "ARS").trim().toUpperCase();

  return (
    Number.isFinite(remoteAmount) &&
    Number.isFinite(localAmount) &&
    Math.abs(remoteAmount - localAmount) <= 0.01 &&
    remoteCurrency === localCurrency
  );
}

export function safeWebhookEvent(body: Record<string, unknown>) {
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  return {
    id: typeof body.id === "string" || typeof body.id === "number" ? String(body.id) : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    action: typeof body.action === "string" ? body.action : undefined,
    api_version: typeof body.api_version === "string" ? body.api_version : undefined,
    date_created: typeof body.date_created === "string" ? body.date_created : undefined,
    live_mode: typeof body.live_mode === "boolean" ? body.live_mode : undefined,
    data: {
      id: typeof data.id === "string" || typeof data.id === "number" ? String(data.id) : undefined
    }
  } satisfies Record<string, unknown>;
}

export function buildMercadoPagoProviderEventId(body: Record<string, unknown>, requestId: string | null) {
  const data = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};
  const notificationId = typeof body.id === "string" || typeof body.id === "number" ? String(body.id).trim() : "";
  const paymentId = typeof data.id === "string" || typeof data.id === "number" ? String(data.id).trim() : "";

  // A Webhooks notification has a notification id and a different payment id.
  // Legacy IPN calls only expose the payment id, so they must remain retryable.
  if (notificationId && paymentId && notificationId !== paymentId) {
    return `notification:${notificationId}`.slice(0, 220);
  }

  const safeRequestId = String(requestId ?? "").trim();
  return safeRequestId ? `request:${safeRequestId}`.slice(0, 220) : null;
}
