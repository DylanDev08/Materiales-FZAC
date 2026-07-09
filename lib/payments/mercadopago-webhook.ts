import "server-only";

import crypto from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MercadoPagoNotConfiguredError, getMercadoPagoConfig } from "@/lib/payments/config";
import { getMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { confirmApprovedPayment } from "@/lib/payments/payment-service";
import { getAdminConsolePath } from "@/lib/utils/env";

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

function parseSignature(value: string | null) {
  return Object.fromEntries(
    String(value ?? "")
      .split(",")
      .map((part) => part.split("=").map((item) => item.trim()))
      .filter((part) => part.length === 2)
  );
}

function isValidWebhookSignature(request: Request, dataId: string) {
  const { webhookSecret } = getMercadoPagoConfig();
  if (!webhookSecret) return true;

  const xSignature = request.headers.get("x-signature");
  const xRequestId = request.headers.get("x-request-id");
  if (!xSignature || !xRequestId || !dataId) return false;

  const signature = parseSignature(xSignature);
  const ts = signature.ts;
  const v1 = signature.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", webhookSecret).update(manifest).digest("hex");
  if (expected.length !== v1.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}

function paymentStatusFromMercadoPago(status: string) {
  if (status === "approved") return "PAID";
  if (status === "rejected" || status === "cancelled") return "FAILED";
  if (status === "refunded") return "REFUNDED";
  if (status === "expired") return "EXPIRED";
  return "PENDING";
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

export async function handleMercadoPagoWebhook(request: Request): Promise<WebhookResult> {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentId = extractPaymentId(url, body);
  const eventType = extractEventType(url, body);
  const eventId = await createPaymentEvent({
    eventType,
    providerEventId: extractEventId(body, paymentId),
    providerPaymentId: paymentId,
    raw: body
  }).catch(() => null);

  if (!paymentId) {
    await updatePaymentEvent(eventId, { status: "IGNORED", errorMessage: "Evento sin payment id." }).catch(() => undefined);
    return { status: 200, body: { ok: true, received: true, ignored: true } };
  }

  if (!isValidWebhookSignature(request, paymentId)) {
    await updatePaymentEvent(eventId, { status: "FAILED", errorMessage: "Firma invalida." }).catch(() => undefined);
    return { status: 401, body: { ok: false, message: "Firma invalida." } };
  }

  try {
    const payment = await getMercadoPagoPayment(paymentId);
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const orderId = String(payment.external_reference || metadata.order_id || "");
    const status = String(payment.status ?? "");

    if (!orderId) {
      await updatePaymentEvent(eventId, { status: "IGNORED", errorMessage: "Pago sin external_reference." }).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, ignored: true } };
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
      await updatePaymentEvent(eventId, {
        status: "FAILED",
        orderId,
        errorMessage: "Backend de pagos no disponible."
      }).catch(() => undefined);
      return { status: 200, body: { ok: false, received: true, message: "Backend de pagos no disponible." } };
    }

    if (status === "approved") {
      await confirmApprovedPayment({
        orderId,
        provider: "MERCADOPAGO",
        providerPaymentId: String(payment.id ?? paymentId),
        raw: payment,
        status: "PAID"
      });
      await updatePaymentEvent(eventId, { status: "PROCESSED", orderId }).catch(() => undefined);
      return { status: 200, body: { ok: true, received: true, status: "PAID", orderId } };
    }

    const paymentStatus = paymentStatusFromMercadoPago(status);
    await admin
      .from("payments")
      .update({
        status: paymentStatus,
        provider_payment_id: String(payment.id ?? paymentId),
        raw: payment,
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
      message: `Mercado Pago informo estado ${status || "pendiente"} para la orden ${orderId}.`,
      link_to: `${getAdminConsolePath()}/pedidos?order=${orderId}`
    });

    await updatePaymentEvent(eventId, { status: "PROCESSED", orderId }).catch(() => undefined);
    return { status: 200, body: { ok: true, received: true, status: paymentStatus, orderId } };
  } catch (error) {
    if (error instanceof MercadoPagoNotConfiguredError) {
      await updatePaymentEvent(eventId, { status: "FAILED", errorMessage: error.message }).catch(() => undefined);
      return { status: 200, body: { ok: false, received: true, message: error.message } };
    }
    await updatePaymentEvent(eventId, {
      status: "FAILED",
      errorMessage: error instanceof Error ? error.message.slice(0, 500) : "No pudimos procesar el webhook."
    }).catch(() => undefined);
    return { status: 200, body: { ok: false, received: true, message: "No pudimos procesar el webhook." } };
  }
}
