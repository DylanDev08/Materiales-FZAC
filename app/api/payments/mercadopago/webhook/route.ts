import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getMercadoPagoPayment } from "@/lib/payments/mercadopago";
import { confirmApprovedPayment } from "@/lib/payments/payment-service";
import { jsonError } from "@/lib/utils/api";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = await request.json().catch(() => ({}));
  const paymentId =
    url.searchParams.get("data.id") ||
    url.searchParams.get("id") ||
    body?.data?.id ||
    body?.id ||
    body?.resource?.split("/").pop();

  if (!paymentId) return jsonError("Webhook sin payment id.", 400);

  try {
    const payment = await getMercadoPagoPayment(String(paymentId));
    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const orderId = String(payment.external_reference || metadata.order_id || "");
    if (!orderId) return jsonError("El pago no tiene orden asociada.", 400);

    const admin = getSupabaseAdminClient();
    if (!admin) return jsonError("Supabase admin no esta configurado.", 500);

    if (payment.status === "approved") {
      await confirmApprovedPayment({
        orderId,
        provider: "MERCADOPAGO",
        providerPaymentId: String(payment.id),
        raw: payment,
        status: "PAID"
      });
    } else {
      await admin
        .from("payments")
        .update({
          status: payment.status === "rejected" ? "FAILED" : "PENDING",
          provider_payment_id: String(payment.id),
          raw: payment,
          updated_at: new Date().toISOString()
        })
        .eq("order_id", orderId);

      await admin.from("notifications").insert({
        target_role: "ADMIN",
        type: payment.status === "rejected" ? "PAYMENT_REJECTED" : "PAYMENT_PENDING",
        title: payment.status === "rejected" ? "Pago rechazado" : "Pago pendiente",
        message: `Mercado Pago informo estado ${payment.status} para la orden ${orderId}.`,
        link_to: `/admin/pedidos?order=${orderId}`
      });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No pudimos procesar el webhook.", 400);
  }
}
