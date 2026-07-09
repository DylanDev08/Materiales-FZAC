import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminConsolePath } from "@/lib/utils/env";
import type { PaymentProvider, PaymentStatus } from "@/types/domain";

type ConfirmationInput = {
  orderId: string;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  raw?: Record<string, unknown> | null;
  status?: PaymentStatus;
};

function ticketNumber() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `FZAC-${stamp}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function isMissingRpcError(error: { code?: string; message?: string }) {
  const message = String(error.message ?? "").toLowerCase();
  return error.code === "PGRST202" || message.includes("finalize_paid_order") || message.includes("could not find the function");
}

async function tryFinalizePaidOrderRpc(input: ConfirmationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para confirmar pagos reales.");

  const { data, error } = await admin.rpc("finalize_paid_order", {
    order_id: input.orderId,
    provider_payment_id: input.providerPaymentId ?? null,
    raw: input.raw ?? {}
  });

  if (!error) return { handled: true, data };
  if (isMissingRpcError(error)) return { handled: false, data: null };
  throw new Error("No pudimos finalizar la orden aprobada desde la base de datos.");
}

export async function confirmApprovedPayment(input: ConfirmationInput) {
  const admin = getSupabaseAdminClient();
  const adminPath = getAdminConsolePath();
  if (!admin) {
    throw new Error("Supabase admin no esta configurado para confirmar pagos reales.");
  }

  const rpcResult = await tryFinalizePaidOrderRpc(input);
  if (rpcResult.handled) return { ok: true, source: "rpc", result: rpcResult.data };

  const { data: existingTicket } = await admin
    .from("purchase_tickets")
    .select("id, number")
    .eq("order_id", input.orderId)
    .maybeSingle();

  if (existingTicket) return { ok: true, ticketNumber: existingTicket.number, alreadyConfirmed: true };

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("*, items:order_items(*)")
    .eq("id", input.orderId)
    .maybeSingle();

  if (orderError || !order) throw new Error("No encontramos la orden para confirmar el pago.");

  if (order.status === "PAID") {
    await admin
      .from("payments")
      .update({
        status: input.status ?? "PAID",
        provider_payment_id: input.providerPaymentId,
        raw: input.raw ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("order_id", order.id);

    return { ok: true, alreadyConfirmed: true };
  }

  const expectedTotal = Number(order.total ?? 0);
  const rawAmount = Number(input.raw?.transaction_amount ?? input.raw?.amount ?? expectedTotal);
  if (Math.abs(rawAmount - expectedTotal) > 1) {
    throw new Error("El monto aprobado no coincide con el total de la orden.");
  }

  const items = (Array.isArray(order.items) ? order.items : []) as Array<Record<string, string | number | null>>;
  const stockSnapshots = new Map<string, { before: number; after: number }>();

  for (const item of items) {
    if (!item.product_id) continue;

    const { data: product } = await admin
      .from("products")
      .select("id, stock, stock_minimum, name")
      .eq("id", item.product_id)
      .maybeSingle();

    if (!product) continue;

    const stockBefore = Number(product.stock ?? 0);
    const stockAfter = Math.max(0, stockBefore - Number(item.quantity ?? 0));
    stockSnapshots.set(String(item.product_id), { before: stockBefore, after: stockAfter });

    await admin.from("products").update({ stock: stockAfter, updated_at: new Date().toISOString() }).eq("id", product.id);

    await admin.from("inventory_movements").insert({
      product_id: product.id,
      order_id: order.id,
      type: "SALE",
      quantity: -Number(item.quantity ?? 0),
      stock_before: stockBefore,
      stock_after: stockAfter,
      reason: "Pago aprobado",
      metadata: { provider: input.provider, providerPaymentId: input.providerPaymentId }
    });

    if (stockAfter <= Number(product.stock_minimum ?? 0)) {
      await admin.from("notifications").insert({
        target_role: "ADMIN",
        type: "LOW_STOCK",
        title: "Stock bajo",
        message: `${product.name} quedo con ${stockAfter} unidades.`,
        link_to: `${adminPath}/productos?product=${product.id}`
      });
    }
  }

  await admin
    .from("orders")
    .update({ status: "PAID", paid_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", order.id);

  await admin
    .from("payments")
    .update({
      status: input.status ?? "PAID",
      provider_payment_id: input.providerPaymentId,
      raw: input.raw ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("order_id", order.id);

  const number = ticketNumber();
  const { data: ticket, error: ticketError } = await admin
    .from("purchase_tickets")
    .insert({
      number,
      order_id: order.id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      payment_provider: input.provider,
      payment_id: input.providerPaymentId,
      subtotal: order.subtotal,
      discount: 0,
      shipping_cost: order.shipping_cost,
      total: order.total,
      shipping_method: order.shipping_method,
      address_snapshot: order.address_snapshot,
      notes: order.notes,
      status: "ISSUED"
    })
    .select("id, number")
    .single();

  if (ticketError || !ticket) throw new Error("No pudimos generar el ticket de compra.");

  const ticketItems = items.map((item: Record<string, string | number | null>) => ({
    ticket_id: ticket.id,
    product_id: item.product_id,
    sku: item.sku,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    subtotal: Number(item.price ?? 0) * Number(item.quantity ?? 0),
    stock_before: item.product_id ? (stockSnapshots.get(String(item.product_id))?.before ?? null) : null,
    stock_after: item.product_id ? (stockSnapshots.get(String(item.product_id))?.after ?? null) : null
  }));

  if (ticketItems.length) await admin.from("purchase_ticket_items").insert(ticketItems);

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "PURCHASE_APPROVED",
    title: "Compra aprobada",
    message: `Nueva compra aprobada por ${order.customer_name}. Ticket ${ticket.number}.`,
    link_to: `${adminPath}/tickets?ticket=${ticket.id}`
  });

  return { ok: true, ticketNumber: ticket.number };
}
