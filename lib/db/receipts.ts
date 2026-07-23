import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AddressSnapshot = {
  street?: string;
  number?: string;
  apartment?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  notes?: string;
};

function addressText(value: unknown) {
  const address = (value ?? {}) as AddressSnapshot;
  const parts = [
    [address.street, address.number].filter(Boolean).join(" "),
    address.apartment,
    address.city,
    address.province,
    address.postalCode
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Sin direccion registrada";
}

function shortReference(value: string) {
  return value.slice(0, 8).toUpperCase();
}

function receiptNumber(orderId: string, ticketNumber?: string | null) {
  return ticketNumber || `FZAC-${shortReference(orderId)}`;
}

export async function getOrderReceipt(orderId?: string) {
  if (!orderId || !UUID_PATTERN.test(orderId)) return null;

  const [admin, profile] = [getSupabaseAdminClient(), await getUserProfile()];
  if (!admin || !profile) return null;

  const { data: order, error } = await admin
    .from("orders")
    .select(
      "id,user_id,status,customer_name,customer_email,customer_phone,subtotal,total,shipping_cost,shipping_method,address_snapshot,created_at,paid_at"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !order) return null;

  const ownsOrder =
    order.user_id === profile.id || String(order.customer_email).toLowerCase() === String(profile.email).toLowerCase();
  if (profile.role !== "ADMIN" && !ownsOrder) return null;

  const [{ data: ticket }, { data: orderItems }, { data: payment }] = await Promise.all([
    admin.from("purchase_tickets").select("*").eq("order_id", order.id).maybeSingle(),
    admin
      .from("order_items")
      .select("sku,name,unit_price,subtotal,quantity")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true }),
    admin.from("payments").select("provider,status,amount,currency,updated_at").eq("order_id", order.id).maybeSingle()
  ]);

  const paymentConfirmed =
    Boolean(ticket) || String(order.status ?? "").toUpperCase() === "PAID" || String(payment?.status ?? "").toUpperCase() === "PAID";
  if (!paymentConfirmed) return null;

  const { data: ticketItems } = ticket?.id
    ? await admin
        .from("purchase_ticket_items")
        .select("sku,name,quantity,unit_price,subtotal")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const items = (ticketItems?.length ? ticketItems : orderItems ?? []).map((item) => {
    const unitPrice = Number(item.unit_price ?? 0);
    const quantity = Number(item.quantity ?? 0);
    return {
      sku: String(item.sku ?? "-"),
      name: String(item.name ?? "Producto"),
      quantity,
      unitPrice,
      subtotal: Number(item.subtotal ?? unitPrice * quantity)
    };
  });

  const total = Number(ticket?.total ?? order.total ?? 0);
  const subtotal = Number(ticket?.subtotal ?? order.subtotal ?? 0);
  const shippingCost = Number(ticket?.shipping_cost ?? order.shipping_cost ?? 0);
  const ivaIncluded = total > 0 ? total - total / 1.21 : 0;

  return {
    number: receiptNumber(order.id, ticket?.number),
    orderId: order.id,
    reference: shortReference(order.id),
    status: String(ticket?.status ?? order.status ?? "PENDIENTE"),
    issuedAt: String(ticket?.issued_at ?? order.paid_at ?? order.created_at),
    customer: {
      name: String(ticket?.customer_name ?? order.customer_name ?? "-"),
      email: String(ticket?.customer_email ?? order.customer_email ?? "-"),
      phone: String(ticket?.customer_phone ?? order.customer_phone ?? "-")
    },
    payment: {
      provider: payment?.provider ? "Pago online" : "Pendiente",
      status: String(payment?.status ?? "PENDING")
    },
    shipping: {
      method: order.shipping_method === "DELIVERY" ? "Envio coordinado" : "Retiro coordinado",
      cost: shippingCost,
      address: addressText(ticket?.address_snapshot ?? order.address_snapshot)
    },
    amounts: {
      subtotal,
      ivaIncluded,
      shippingCost,
      total
    },
    items
  };
}

export type OrderReceipt = Awaited<ReturnType<typeof getOrderReceipt>>;
