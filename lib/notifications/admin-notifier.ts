import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminConsolePath } from "@/lib/utils/env";

type AdminNotificationInput = {
  type: string;
  title: string;
  message: string;
  linkTo?: string;
};

async function notifyAdmin(input: AdminNotificationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: input.type,
    title: input.title,
    message: input.message,
    link_to: input.linkTo ?? getAdminConsolePath()
  });
}

export async function notifyAdminNewOrder(order: { id: string; customerName: string; total: number }) {
  await notifyAdmin({
    type: "ORDER_CREATED",
    title: "Nueva compra creada",
    message: `${order.customerName} creo una compra por $${Math.round(order.total).toLocaleString("es-AR")}.`,
    linkTo: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });
}

export async function notifyAdminPaymentPending(order: { id: string; customerName: string }) {
  await notifyAdmin({
    type: "PAYMENT_PENDING",
    title: "Pago pendiente",
    message: `Nueva orden pendiente de pago por ${order.customerName}.`,
    linkTo: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });
}

export async function notifyAdminTransferPending(order: { id: string; customerName: string; total: number; flow: "BANK_TRANSFER" | "WHATSAPP" }) {
  await notifyAdmin({
    type: order.flow === "BANK_TRANSFER" ? "TRANSFER_PENDING" : "PAYMENT_COORDINATION_PENDING",
    title: order.flow === "BANK_TRANSFER" ? "Nuevo pedido por transferencia pendiente" : "Pago para coordinar",
    message:
      order.flow === "BANK_TRANSFER"
        ? `${order.customerName} genero un pedido por $${Math.round(order.total).toLocaleString("es-AR")} y espera datos de transferencia.`
        : `${order.customerName} genero un pedido por $${Math.round(order.total).toLocaleString("es-AR")} para coordinar por WhatsApp.`,
    linkTo: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });
}

export async function notifyAdminPaymentApproved(order: { id: string; customerName: string; ticketNumber?: string }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const linkTo = `${getAdminConsolePath()}/pedidos?order=${order.id}`;
  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("type", "PURCHASE_APPROVED")
    .eq("link_to", linkTo)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "PURCHASE_APPROVED",
    title: "Pago aprobado · ingreso registrado",
    message: `Nueva compra aprobada por ${order.customerName}${order.ticketNumber ? `. Ticket ${order.ticketNumber}` : "."} El ingreso ya quedó registrado automáticamente en Finanzas.`,
    link_to: linkTo
  });
}

export async function notifyAdminLargePurchase(order: { id: string; customerName: string; total: number; limit: number }) {
  await notifyAdmin({
    type: "LARGE_PURCHASE_REVIEW",
    title: "PRIORIDAD ALTA · compra grande",
    message: `${order.customerName} creó una compra por ${Math.round(order.total).toLocaleString("es-AR")}. Supera el límite automático de ${Math.round(order.limit).toLocaleString("es-AR")} y requiere revisión prioritaria antes de habilitar el pago.`,
    linkTo: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });
}


export async function notifyAdminFulfillmentRequired(order: {
  id: string;
  customerName: string;
  customerPhone?: string | null;
  shippingMethod: string;
  shippingCost?: number;
  address?: Record<string, unknown> | null;
  ticketNumber?: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return;

  const delivery = order.shippingMethod === "DELIVERY";
  const linkTo = `${getAdminConsolePath()}/pedidos?order=${order.id}`;
  const type = delivery ? "DELIVERY_COORDINATION_REQUIRED" : "PICKUP_PREPARATION_REQUIRED";

  const { data: existing } = await admin
    .from("notifications")
    .select("id")
    .eq("type", type)
    .eq("link_to", linkTo)
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  const address = order.address && typeof order.address === "object"
    ? [
        order.address.street,
        order.address.number,
        order.address.city,
        order.address.province
      ].filter(Boolean).join(" ")
    : "";

  const reference = order.id.slice(0, 8).toUpperCase();
  const ticket = order.ticketNumber ? ` · Ticket ${order.ticketNumber}` : "";
  const phone = order.customerPhone ? ` · Tel. ${order.customerPhone}` : "";

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type,
    title: delivery ? "PAGO APROBADO · ORGANIZAR DESPACHO" : "PAGO APROBADO · PREPARAR RETIRO",
    message: delivery
      ? `${order.customerName} · Pedido ${reference}${ticket}${phone}. Coordinar flete${address ? ` a ${address}` : ""}${order.shippingCost ? ` · Envío $${Math.round(order.shippingCost).toLocaleString("es-AR")}` : ""}.`
      : `${order.customerName} · Pedido ${reference}${ticket}${phone}. Preparar mercadería y coordinar retiro en local.`,
    link_to: linkTo
  });
}
