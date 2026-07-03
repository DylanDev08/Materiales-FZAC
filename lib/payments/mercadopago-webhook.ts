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

export async function handleMercadoPagoWebhook(request: Request): Promise<WebhookResult> {
  const url = new URL(request.url);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const paymentId = extractPaymentId(url, body);

  if (!paymentId) {
    return { status: 200, body: { ok: true, received: true, ignored: true } };
  }

  if (!isValidWebhookSignature(request, paymentId)) {
    return { status: 401, body: { ok: false, message: "Firma invalida." } };
  }

  try {
    const payment = await getMercadoPagoPayment(paymentId);
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const orderId = String(payment.external_reference || metadata.order_id || "");
    const status = String(payment.status ?? "");

    if (!orderId) {
      return { status: 200, body: { ok: true, received: true, ignored: true } };
    }

    const admin = getSupabaseAdminClient();
    if (!admin) {
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

    return { status: 200, body: { ok: true, received: true, status: paymentStatus, orderId } };
  } catch (error) {
    if (error instanceof MercadoPagoNotConfiguredError) {
      return { status: 200, body: { ok: false, received: true, message: error.message } };
    }
    return { status: 200, body: { ok: false, received: true, message: "No pudimos procesar el webhook." } };
  }
}
