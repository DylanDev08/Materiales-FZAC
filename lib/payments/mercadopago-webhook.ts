import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  MercadoPagoNotConfiguredError,
  getMercadoPagoConfig,
  paymentLiveModeMatchesEnvironment
} from "@/lib/payments/config";
import { getMercadoPagoPayment, sanitizeMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { confirmApprovedPayment, finalizeRefundedPayment } from "@/lib/payments/payment-service";
import { getAdminConsolePath } from "@/lib/utils/env";
import { validateMercadoPagoSignature } from "@/lib/payments/mercadopago-signature";

type WebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

function extractPaymentId(url: URL, body: Record<string, unknown>) {
  const data = body.data as Record<string, unknown> | undefined;
  const resource = typeof body.resource === "string" ? body.resource.split("/").pop() : "";

  return (
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    String(data?.id ?? "") ||
    String(body.id ?? "") ||
    resource ||
    ""
  ).trim();
}

function isValidWebhookSignature(request: Request, dataId: string) {
  const { webhookSecret, paymentsEnv } = getMercadoPagoConfig();
  if (!webhookSecret) {
    if (paymentsEnv === "production") {
      console.error("[mercadopago.webhook.security]", {
        message: "MERCADOPAGO_WEBHOOK_SECRET no esta configurado en produccion.",
        data_id_present: Boolean(dataId)
      });
      return false;
    }

    console.warn("[mercadopago.webhook.security]", {
      message: "Webhook sin firma permitido solo en entorno de prueba.",
      data_id_present: Boolean(dataId)
    });
    return true;
  }

  return validateMercadoPagoSignature({
    webhookSecret,
    paymentsEnv,
    dataId,
    xSignature: request.headers.get("x-signature"),
    xRequestId: request.headers.get("x-request-id")
  });
}

function paymentStatusFromMercadoPago(status: string) {
  if (status === "approved") return "PAID";
  if (status === "rejected" || status === "cancelled") return "FAILED";
  if (status === "refunded" || status === "charged_back") return "REFUNDED";
  if (status === "expired") return "EXPIRED";
  return "PENDING";
}

function providerRefundId(payment: Record<string, unknown>) {
  const refunds = Array.isArray(payment.refunds) ? payment.refunds : [];
  const latest = refunds.at(-1);
  if (!latest || typeof latest !== "object") return null;
  const id = (latest as Record<string, unknown>).id;
  return id ? String(id) : null;
}

function orderStatusFromMercadoPago(status: string) {
  if (["cancelled", "expired", "refunded", "charged_back"].includes(status)) return "CANCELLED";
  return "PENDING_PAYMENT";
}

function extractEventType(url: URL, body: Record<string, unknown>) {
  return String(body.type || body.topic || body.action || url.searchParams.get("topic") || "payment");
}

function extractEventId(body: Record<string, unknown>, paymentId: string) {
  const data = body.data as Record<string, unknown> | undefined;
  return String(body.id || data?.id || paymentId || "");
}

function paymentAmountMatchesLocal(
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

function safeWebhookEvent(body: Record<string, unknown>) {
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

async function createPaymentEvent(input: {
  eventType: string;
  providerEventId: string;
  providerPaymentId: string;
  raw: Record<string, unknown>;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("payment_events")
    .insert({
      provider: "MERCADOPAGO",
      provider_event_id: input.providerEventId || null,
      provider_payment_id: input.providerPaymentId || null,
      event_type: input.eventType,
      status: "RECEIVED",
      raw: input.raw
    })
    .select("id")
    .maybeSingle();

  return data?.id ? String(data.id) : null;
}

async function updatePaymentEvent(
  eventId: string | null,
  input: { status: "PROCESSED" | "IGNORED" | "FAILED"; orderId?: string; errorMessage?: string }
) {
  if (!eventId) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin
    .from("payment_events")
    .update({
      status: input.status,
      order_id: input.orderId || null,
      error_message: input.errorMessage || null,
      processed_at: new Date().toISOString()
    })
    .eq("id", eventId);
}

async function notifyWebhookFailure(orderId?: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "WEBHOOK_ERROR",
    title: "Revisar notificacion de pago",
    message: orderId
      ? `No pudimos procesar una notificacion para el pedido ${orderId.slice(0, 8).toUpperCase()}.`
      : "No pudimos procesar una notificacion de Mercado Pago.",
    link_to: `${getAdminConsolePath()}/pagos/eventos`
  });
}

export async function handleMercadoPagoWebhook(request: Request): Promise<WebhookResult> {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentId = extractPaymentId(url, body);
  const eventType = extractEventType(url, body);

  if (!paymentId) {
    return { status: 200, body: { ok: true, received: true, ignored: true } };
  }

  if (!isValidWebhookSignature(request, paymentId)) {
    return { status: 401, body: { ok: false, message: "Firma invalida." } };
  }

  const eventId = await createPaymentEvent({
    eventType,
    providerEventId: extractEventId(body, paymentId),
    providerPaymentId: paymentId,
    raw: safeWebhookEvent(body)
  }).catch(() => null);

  try {
    const payment = await getMercadoPagoPayment(paymentId);
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const orderId = String(payment.external_reference || metadata.order_id || "");
    const status = String(payment.status ?? "");
    const safePayment = sanitizeMercadoPagoPayment(payment);

    if (!orderId) {
      await updatePaymentEvent(eventId, { status: "IGNORED", errorMessage: "Pago sin external_reference." }).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, ignored: true } };
    }

    if (!paymentLiveModeMatchesEnvironment(payment.live_mode)) {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "El ambiente del pago no coincide con PAYMENTS_ENV."
      }).catch(() => undefined);
      await notifyWebhookFailure(orderId).catch(() => undefined);
      return { status: 409, body: { ok: false, received: true, message: "Ambiente de pago incompatible." } };
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "Backend de pagos no disponible."
      }).catch(() => undefined);
      return { status: 503, body: { ok: false, received: true, message: "Backend de pagos no disponible." } };
    }

    const { data: localPayment } = await admin
      .from("payments")
      .select("id,provider,status,amount,currency,provider_payment_id")
      .eq("order_id", orderId)
      .maybeSingle();

    const providerId = String(payment.id ?? paymentId);
    if (
      !localPayment ||
      localPayment.provider !== "MERCADOPAGO" ||
      (localPayment.provider_payment_id && String(localPayment.provider_payment_id) !== providerId)
    ) {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "El pago no coincide con la orden local."
      }).catch(() => undefined);
      await notifyWebhookFailure(orderId).catch(() => undefined);
      return { status: 409, body: { ok: false, received: true, message: "Pago no asociado a la orden." } };
    }

    if (!paymentAmountMatchesLocal(payment, localPayment)) {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "El monto o la moneda no coincide con la orden local."
      }).catch(() => undefined);
      await notifyWebhookFailure(orderId).catch(() => undefined);
      return { status: 409, body: { ok: false, received: true, message: "Monto de pago incompatible." } };
    }

    if (status === "partially_refunded") {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "Reembolso parcial pendiente de conciliacion manual."
      }).catch(() => undefined);
      await notifyWebhookFailure(orderId).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, manual_review: true } };
    }

    if (status === "approved") {
      await confirmApprovedPayment({
        orderId,
        provider: "MERCADOPAGO",
        providerPaymentId: providerId,
        raw: safePayment,
        status: "PAID"
      });
      await updatePaymentEvent(eventId, { status: "PROCESSED", orderId }).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, status: "PAID", orderId } };
    }

    if (status === "refunded" || status === "charged_back") {
      await finalizeRefundedPayment({
        paymentId: String(localPayment.id),
        providerRefundId: providerRefundId(payment),
        raw: safePayment,
        reason: status === "charged_back" ? "Contracargo confirmado por Mercado Pago" : "Reembolso confirmado por Mercado Pago",
        actorId: null,
        actorEmail: "Mercado Pago webhook"
      });
      await updatePaymentEvent(eventId, { status: "PROCESSED", orderId }).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, status: "REFUNDED", orderId } };
    }

    const paymentStatus = paymentStatusFromMercadoPago(status);
    await admin
      .from("payments")
      .update({
        status: paymentStatus,
        provider_payment_id: providerId,
        raw: safePayment,
        updated_at: new Date().toISOString()
      })
      .eq("order_id", orderId);

    if (paymentStatus !== "PENDING") {
      await admin
        .from("orders")
        .update({ status: orderStatusFromMercadoPago(status), updated_at: new Date().toISOString() })
        .eq("id", orderId);
    }

    await admin.from("notifications").insert({
      target_role: "ADMIN",
      type: paymentStatus === "FAILED" ? "PAYMENT_REJECTED" : "PAYMENT_PENDING",
      title: paymentStatus === "FAILED" ? "Pago rechazado" : "Pago pendiente",
      message: `Mercado Pago informo estado ${status || "pendiente"} para el pedido ${orderId.slice(0, 8).toUpperCase()}.`,
      link_to: `${getAdminConsolePath()}/pedidos?order=${orderId}`
    });

    await updatePaymentEvent(eventId, { status: "PROCESSED", orderId }).catch(() => undefined);
    return { status: 200, body: { ok: true, received: true, status: paymentStatus, orderId } };
  } catch (error) {
    if (error instanceof MercadoPagoNotConfiguredError) {
      await updatePaymentEvent(eventId, { status: "FAILED", errorMessage: error.message }).catch(() => undefined);
      await notifyWebhookFailure().catch(() => undefined);
      return { status: 503, body: { ok: false, received: true, message: "Proveedor de pago no configurado." } };
    }
    await updatePaymentEvent(eventId, {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "No pudimos procesar el webhook."
    }).catch(() => undefined);
    await notifyWebhookFailure().catch(() => undefined);
    return { status: 503, body: { ok: false, received: true, message: "No pudimos procesar el webhook." } };
  }
}
