import { createClient } from "@supabase/supabase-js";

const confirmation = process.env.QA_CLEANUP_CONFIRM;
const shouldDelete = confirmation === "DELETE_ISOLATED_QA";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const safeStatuses = new Set(["PENDING_PAYMENT", "PENDING_TRANSFER", "PENDING_ADMIN_APPROVAL", "COORDINATE"]);
const qaMarker = /qa|automatizado|no preparar|prueba|test|checkout/i;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { data: pendingOrders, error: orderError } = await admin
  .from("orders")
  .select("id,user_id,status,customer_email,notes,paid_at")
  .in("status", [...safeStatuses])
  .limit(1000);
if (orderError) throw orderError;

const candidates = (pendingOrders ?? []).filter(
  (order) =>
    /@example\.com$/i.test(String(order.customer_email ?? "")) &&
    qaMarker.test(`${order.customer_email ?? ""} ${order.notes ?? ""}`)
);
const orderIds = candidates.map((order) => String(order.id));

if (!orderIds.length) {
  console.log(JSON.stringify({ ok: true, mode: shouldDelete ? "delete" : "dry-run", candidates: 0 }));
} else {
  const [{ data: payments, error: paymentError }, { data: tickets, error: ticketError }] = await Promise.all([
    admin
      .from("payments")
      .select("id,order_id,status,provider,provider_preference_id")
      .in("order_id", orderIds),
    admin.from("purchase_tickets").select("id,order_id").in("order_id", orderIds)
  ]);
  if (paymentError || ticketError) throw new Error("Could not verify QA payment and ticket records.");

  assert(
    candidates.every((order) => safeStatuses.has(String(order.status)) && !order.paid_at),
    "Cleanup stopped because a candidate order is no longer safely pending."
  );
  assert((payments ?? []).every((payment) => payment.status === "PENDING"), "Cleanup stopped because a QA payment is not pending.");
  assert((tickets ?? []).length === 0, "Cleanup stopped because a QA order already has a purchase ticket.");

  const summary = {
    candidates: orderIds.length,
    payments: (payments ?? []).length,
    mercadoPagoPreferences: (payments ?? []).filter((payment) => payment.provider_preference_id).length,
    tickets: (tickets ?? []).length
  };

  if (!shouldDelete) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", ...summary }));
  } else {
    const deactivationErrors = [];
    if (mercadoPagoAccessToken) {
      const preferenceIds = Array.from(
        new Set((payments ?? []).map((payment) => payment.provider_preference_id).filter(Boolean))
      );
      for (const preferenceId of preferenceIds) {
        const response = await fetch(
          `https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(String(preferenceId))}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${mercadoPagoAccessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ active: false })
          }
        ).catch(() => null);
        if (!response?.ok && response?.status !== 404) {
          deactivationErrors.push(response?.status ?? 0);
        }
      }
    }
    assert(deactivationErrors.length === 0, "Cleanup stopped because a Mercado Pago QA preference could not be deactivated.");

    for (const orderId of orderIds) {
      const { error } = await admin.from("notifications").delete().like("link_to", `%${orderId}%`);
      if (error) throw new Error("Could not remove a QA admin notification.");
    }

    const { error: deleteError, count } = await admin
      .from("orders")
      .delete({ count: "exact" })
      .in("id", orderIds);
    if (deleteError || count !== orderIds.length) throw new Error("Could not remove every verified QA order.");

    console.log(JSON.stringify({ ok: true, mode: "delete", ...summary, deleted: count }));
  }
}
