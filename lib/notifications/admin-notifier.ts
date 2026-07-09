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
  await notifyAdmin({
    type: "PURCHASE_APPROVED",
    title: "Compra aprobada",
    message: `Nueva compra aprobada por ${order.customerName}${order.ticketNumber ? `. Ticket ${order.ticketNumber}` : "."}`,
    linkTo: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });
}

export async function notifyAdminLargePurchase(order: { id: string; customerName: string; total: number; limit: number }) {
  await notifyAdmin({
    type: "LARGE_PURCHASE_REVIEW",
    title: "Compra grande para revisar",
    message: `${order.customerName} creo una compra por $${Math.round(order.total).toLocaleString("es-AR")}. Supera el limite automatico de $${Math.round(order.limit).toLocaleString("es-AR")}.`,
    linkTo: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });
}
