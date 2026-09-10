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
import {
  buildMercadoPagoProviderEventId,
  isMercadoPagoPaymentId,
  mercadoPagoWebhookAction,
  orderStatusFromMercadoPago,
  paymentAmountMatchesLocal,
  paymentStatusFromMercadoPago,
  providerRefundId,
  safeWebhookEvent
} from "@/lib/payments/mercadopago-webhook-policy";

type WebhookResult = {
  status: number;
  body: Record<string, unknown>;
};

const MAX_WEBHOOK_BYTES = 64 * 1024;

async function readWebhookBody(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return { ok: false as const, status: 413, message: "Notificacion demasiado extensa." };
  }

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_WEBHOOK_BYTES) {
    return { ok: false as const, status: 413, message: "Notificacion demasiado extensa." };
  }
  if (!raw.trim()) return { ok: true as const, body: {} as Record<string, unknown> };

  try {
    const body = JSON.parse(raw) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_BODY");
    return { ok: true as const, body: body as Record<string, unknown> };
  } catch {
    return { ok: false as const, status: 400, message: "Notificacion invalida." };
  }
}

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

function extractEventType(url: URL, body: Record<string, unknown>) {
  return String(body.type || body.topic || body.action || url.searchParams.get("topic") || "payment")
    .trim()
    .slice(0, 80) || "payment";
}

async function createPaymentEvent(input: {
  eventType: string;
  providerEventId: string | null;
  providerPaymentId: string;
  raw: Record<string, unknown>;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  if (input.providerEventId) {
    const { data: existing, error: existingError } = await admin
      .from("payment_events")
      .select("id,status")
      .eq("provider", "MERCADOPAGO")
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();

    if (existingError) throw existingError;
    if (existing?.id) {
      const status = String(existing.status);
      if (status === "FAILED") {
        await admin
          .from("payment_events")
          .update({ status: "RECEIVED", raw: input.raw, error_message: null, processed_at: null })
          .eq("id", existing.id);
      }
      return {
        id: String(existing.id),
        duplicate: status === "PROCESSED" || status === "IGNORED"
      };
    }
  }

  const { data, error } = await admin
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

  if (error?.code === "23505" && input.providerEventId) {
    const { data: existing } = await admin
      .from("payment_events")
      .select("id,status")
      .eq("provider", "MERCADOPAGO")
      .eq("provider_event_id", input.providerEventId)
      .maybeSingle();
    if (existing?.id) {
      const status = String(existing.status);
      return { id: String(existing.id), duplicate: status === "PROCESSED" || status === "IGNORED" };
    }
  }
  if (error) throw error;

  return { id: data?.id ? String(data.id) : null, duplicate: false };
}

async function updatePaymentEvent(
  eventId: string | null,
  input: { status: "PROCESSED" | "IGNORED" | "FAILED"; orderId?: string; errorMessage?: string }
) {
  if (!eventId) return;

  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("PAYMENT_EVENT_BACKEND_UNAVAILABLE");

  const { error } = await admin
    .from("payment_events")
    .update({
      status: input.status,
      order_id: input.orderId || null,
      error_message: input.errorMessage || null,
      processed_at: new Date().toISOString()
    })
    .eq("id", eventId);
  if (error) throw new Error("PAYMENT_EVENT_UPDATE_FAILED");
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
  const payload = await readWebhookBody(request);
  if (!payload.ok) return { status: payload.status, body: { ok: false, message: payload.message } };
  const body = payload.body;
  const paymentId = extractPaymentId(url, body);
  const eventType = extractEventType(url, body);

  if (!paymentId) {
    return { status: 200, body: { ok: true, received: true, ignored: true } };
  }

  if (!isMercadoPagoPaymentId(paymentId)) {
    return { status: 400, body: { ok: false, received: false, message: "Notificacion de pago invalida." } };
  }

  if (!isValidWebhookSignature(request, paymentId)) {
    return { status: 401, body: { ok: false, message: "Firma invalida." } };
  }

  let eventReceipt: Awaited<ReturnType<typeof createPaymentEvent>>;
  try {
    eventReceipt = await createPaymentEvent({
      eventType,
      providerEventId: buildMercadoPagoProviderEventId(body, request.headers.get("x-request-id")),
      providerPaymentId: paymentId,
      raw: safeWebhookEvent(body)
    });
  } catch {
    console.error("[mercadopago.webhook.audit]", {
      message: "No pudimos registrar el evento antes de procesarlo.",
      payment_id_present: Boolean(paymentId)
    });
    return { status: 503, body: { ok: false, received: false, message: "No pudimos registrar la notificacion." } };
  }
  if (!eventReceipt?.id) {
    return { status: 503, body: { ok: false, received: false, message: "No pudimos registrar la notificacion." } };
  }
  const eventId = eventReceipt?.id ?? null;

  if (eventReceipt?.duplicate) {
    return { status: 200, body: { ok: true, received: true, duplicate: true } };
  }

  try {
    const payment = await getMercadoPagoPayment(paymentId);
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const orderId = String(payment.external_reference || metadata.order_id || "");
    const status = String(payment.status ?? "");
    const action = mercadoPagoWebhookAction(status);
    const safePayment = sanitizeMercadoPagoPayment(payment);

    if (!orderId) {
      await updatePaymentEvent(eventId, { status: "IGNORED", errorMessage: "Pago sin external_reference." });
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

    if (action === "MANUAL_REVIEW") {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "Reembolso parcial pendiente de conciliacion manual."
      }).catch(() => undefined);
      await notifyWebhookFailure(orderId).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, manual_review: true } };
    }

    if (action === "CONFIRM") {
      await confirmApprovedPayment({
        orderId,
        provider: "MERCADOPAGO",
        providerPaymentId: providerId,
        raw: safePayment,
        status: "PAID"
      });
      await updatePaymentEvent(eventId, { status: "PROCESSED", orderId });
      return { status: 200, body: { ok: true, received: true, status: "PAID", orderId } };
    }

    if (action === "REFUND") {
      await finalizeRefundedPayment({
        paymentId: String(localPayment.id),
        providerRefundId: providerRefundId(payment),
        raw: safePayment,
        reason: status === "charged_back" ? "Contracargo confirmado por Mercado Pago" : "Reembolso confirmado por Mercado Pago",
        actorId: null,
        actorEmail: "Mercado Pago webhook"
      });
      await updatePaymentEvent(eventId, { status: "PROCESSED", orderId });
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

    await updatePaymentEvent(eventId, { status: "PROCESSED", orderId });
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
