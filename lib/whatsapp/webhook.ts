import "server-only";

import { getAdminConsolePath } from "@/lib/utils/env";
import { rateLimitIdentity } from "@/lib/utils/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppDocument, sendWhatsAppText } from "@/lib/whatsapp/client";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import type { WhatsAppInboundMessage } from "@/lib/whatsapp/message-parser";
import { createBankTransferPdf, getBankTransferDetails } from "@/lib/whatsapp/payment-document";
import { createWhatsAppReply } from "@/lib/whatsapp/responder";
import { privatePhoneReference } from "@/lib/whatsapp/security";

type ProcessingResult = "PROCESSED" | "DUPLICATE" | "RATE_LIMITED" | "UNAVAILABLE" | "INVALID";
type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;

type RelatedOrder = {
  id: string;
  status: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  shipping_method: string;
  address_snapshot: Record<string, unknown> | null;
};

function phoneKey(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-10);
}

function orderReference(value: string) {
  const match = value.match(/(?:pedido|referencia)\s*:?\s*#?([a-f0-9]{8})/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function asksForPayment(value: string) {
  const text = normalizedText(value);
  return /transfer|pagar|pago|datos banc|alias|cvu|confirmar mi encargo|quiero confirmar mi pedido/.test(text);
}

async function findOrCreateConversation(input: {
  hash: string;
  last4: string;
  name: string | null;
  subject: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data: existing } = await admin
    .from("chat_conversations")
    .select("id,status")
    .eq("channel", "WHATSAPP")
    .eq("phone_hash", input.hash)
    .neq("status", "CLOSED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing;

  const { data, error } = await admin
    .from("chat_conversations")
    .insert({
      user_id: null,
      visitor_id: `whatsapp:${input.hash}`,
      channel: "WHATSAPP",
      status: "OPEN",
      subject: input.name ? `${input.name}: ${input.subject}`.slice(0, 160) : input.subject.slice(0, 160),
      phone_hash: input.hash,
      phone_last4: input.last4,
      updated_at: new Date().toISOString()
    })
    .select("id,status")
    .single();
  if (!error) return data;
  if (error.code !== "23505") return null;
  const { data: concurrent } = await admin
    .from("chat_conversations")
    .select("id,status")
    .eq("channel", "WHATSAPP")
    .eq("phone_hash", input.hash)
    .neq("status", "CLOSED")
    .maybeSingle();
  return concurrent ?? null;
}

async function contextForConversation(admin: AdminClient, conversationId: string) {
  const { data } = await admin
    .from("chat_messages")
    .select("role,metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(30);

  let orderId: string | null = null;
  let paymentDetailsSent = false;
  for (const row of data ?? []) {
    const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata as Record<string, unknown> : {};
    if (!orderId && typeof metadata.order_id === "string") orderId = metadata.order_id;
    if (metadata.intent === "ecommerce_payment_details") paymentDetailsSent = true;
  }
  return { orderId, paymentDetailsSent };
}

async function findRelatedOrder(
  admin: AdminClient,
  message: WhatsAppInboundMessage,
  conversationId: string
): Promise<RelatedOrder | null> {
  const reference = orderReference(message.body);
  const context = await contextForConversation(admin, conversationId);

  if (context.orderId) {
    const { data } = await admin
      .from("orders")
      .select("id,status,total,customer_name,customer_phone,shipping_method,address_snapshot")
      .eq("id", context.orderId)
      .maybeSingle();
    if (data) return {
      ...data,
      total: Number(data.total ?? 0),
      address_snapshot: data.address_snapshot && typeof data.address_snapshot === "object"
        ? data.address_snapshot as Record<string, unknown>
        : null
    } as RelatedOrder;
  }

  const { data: candidates } = await admin
    .from("orders")
    .select("id,status,total,customer_name,customer_phone,shipping_method,address_snapshot,created_at")
    .in("status", ["PENDING_PAYMENT", "PENDING_ADMIN_APPROVAL", "CONFIRMED", "PAID", "PREPARING"])
    .order("created_at", { ascending: false })
    .limit(100);

  const sourcePhone = phoneKey(message.from);
  const matching = (candidates ?? []).filter((row) => phoneKey(String(row.customer_phone ?? "")) === sourcePhone);
  const chosen = reference
    ? matching.find((row) => String(row.id).replace(/-/g, "").toUpperCase().startsWith(reference))
      ?? matching.find((row) => String(row.id).toUpperCase().startsWith(reference))
    : matching[0];

  if (!chosen) return null;
  return {
    id: String(chosen.id),
    status: String(chosen.status),
    total: Number(chosen.total ?? 0),
    customer_name: String(chosen.customer_name ?? "Cliente"),
    customer_phone: String(chosen.customer_phone ?? ""),
    shipping_method: String(chosen.shipping_method ?? "PICKUP"),
    address_snapshot: chosen.address_snapshot && typeof chosen.address_snapshot === "object"
      ? chosen.address_snapshot as Record<string, unknown>
      : null
  };
}

async function persistAssistantMessage(admin: AdminClient, input: {
  conversationId: string;
  content: string;
  providerMessageId: string | null;
  messageType?: string;
  metadata: Record<string, unknown>;
}) {
  await admin.from("chat_messages").insert({
    conversation_id: input.conversationId,
    role: "ASSISTANT",
    content: input.content,
    external_message_id: input.providerMessageId,
    direction: "OUTBOUND",
    message_type: input.messageType ?? "TEXT",
    metadata: input.metadata
  });
}

export async function processWhatsAppMessage(message: WhatsAppInboundMessage): Promise<ProcessingResult> {
  const config = getWhatsAppConfig();
  const reference = privatePhoneReference(message.from, config.appSecret);
  if (!reference || !message.id) return "INVALID";
  const rate = rateLimitIdentity("whatsapp-webhook", reference.hash, 18, 60_000);
  if (!rate.ok) return "RATE_LIMITED";
  const admin = getSupabaseAdminClient();
  if (!admin) return "UNAVAILABLE";

  const { data: duplicate } = await admin.from("chat_messages").select("id").eq("external_message_id", message.id).maybeSingle();
  if (duplicate) return "DUPLICATE";

  const conversation = await findOrCreateConversation({
    hash: reference.hash,
    last4: reference.last4,
    name: message.customerName,
    subject: message.body || (message.type === "LOCATION" ? "Ubicación para pedido" : "Mensaje de WhatsApp")
  });
  if (!conversation?.id) return "UNAVAILABLE";

  const context = await contextForConversation(admin, conversation.id);
  const order = await findRelatedOrder(admin, message, conversation.id);
  const isMedia = message.type === "IMAGE" || message.type === "DOCUMENT";
  const isPaymentProof = Boolean(isMedia && message.mediaId && order && context.paymentDetailsSent);
  const isEcommercePayment = Boolean(order && asksForPayment(message.body));

  let inboundContent = message.body || "[mensaje no textual]";
  if (message.type === "LOCATION") inboundContent = "[ubicación exacta compartida por WhatsApp]";
  if (isPaymentProof) inboundContent = `[comprobante de pago adjunto${message.filename ? `: ${message.filename}` : ""}]`;

  const { error: inboundError } = await admin.from("chat_messages").insert({
    conversation_id: conversation.id,
    role: "USER",
    content: inboundContent,
    external_message_id: message.id,
    direction: "INBOUND",
    message_type: message.type,
    metadata: {
      channel: "WHATSAPP",
      order_id: order?.id ?? context.orderId ?? null,
      ecommerce: Boolean(order),
      media_id: message.mediaId,
      mime_type: message.mimeType,
      filename: message.filename,
      latitude: message.latitude,
      longitude: message.longitude,
      location_name: message.locationName,
      location_address: message.locationAddress,
      provider_timestamp: message.timestamp
    }
  });
  if (inboundError) return inboundError.code === "23505" ? "DUPLICATE" : "UNAVAILABLE";

  const now = new Date().toISOString();

  if (message.type === "LOCATION" && message.latitude !== null && message.longitude !== null) {
    if (order) {
      await admin
        .from("orders")
        .update({
          address_snapshot: {
            ...(order.address_snapshot ?? {}),
            whatsapp_location: {
              latitude: message.latitude,
              longitude: message.longitude,
              name: message.locationName,
              address: message.locationAddress,
              received_at: now
            }
          },
          updated_at: now
        })
        .eq("id", order.id);
    }

    const body = order
      ? `Ubicación exacta recibida para el pedido ${order.id.slice(0, 8).toUpperCase()}. La vamos a usar para coordinar el flete cuando el pago quede aprobado.`
      : "Ubicación recibida. Si corresponde a una compra de FZAC, enviame también la referencia del pedido para asociarla correctamente.";
    const sent = await sendWhatsAppText(message.from, body);
    await persistAssistantMessage(admin, {
      conversationId: conversation.id,
      content: body,
      providerMessageId: sent.providerMessageId,
      metadata: {
        channel: "WHATSAPP",
        intent: "ecommerce_location_received",
        order_id: order?.id ?? null,
        delivery_status: sent.status,
        dry_run: config.dryRun
      }
    });
    await admin.from("chat_conversations").update({ status: "OPEN", updated_at: now }).eq("id", conversation.id);
    return "PROCESSED";
  }

  if (isPaymentProof && order && message.mediaId) {
    await admin.from("whatsapp_payment_proofs").insert({
      order_id: order.id,
      conversation_id: conversation.id,
      external_message_id: message.id,
      media_id: message.mediaId,
      mime_type: message.mimeType,
      filename: message.filename,
      status: "PENDING_REVIEW",
      customer_phone_last4: reference.last4
    });

    const body = `Recibimos tu comprobante para el pedido ${order.id.slice(0, 8).toUpperCase()}. Queda pendiente de validación por un responsable de FZAC. No hace falta que vuelvas a transferir ni que reenvíes el comprobante. Cuando lo aprueben, coordinamos proveedor y ${order.shipping_method === "DELIVERY" ? "flete" : "retiro"}.`;
    const sent = await sendWhatsAppText(message.from, body);
    await persistAssistantMessage(admin, {
      conversationId: conversation.id,
      content: body,
      providerMessageId: sent.providerMessageId,
      metadata: {
        channel: "WHATSAPP",
        intent: "ecommerce_payment_proof_waiting_admin",
        order_id: order.id,
        proof_media_id: message.mediaId,
        delivery_status: sent.status,
        dry_run: config.dryRun
      }
    });

    await admin.from("chat_conversations").update({ status: "WAITING_ADMIN", updated_at: now }).eq("id", conversation.id);
    await admin.from("notifications").insert({
      target_role: "ADMIN",
      type: "WHATSAPP_PAYMENT_PROOF",
      title: "Comprobante esperando validación",
      message: `${order.customer_name} envió un comprobante para el pedido ${order.id.slice(0, 8).toUpperCase()}.`,
      link_to: `${getAdminConsolePath()}/pedidos`
    });
    return "PROCESSED";
  }

  if (isEcommercePayment && order) {
    const bank = getBankTransferDetails();
    if (!bank) {
      const body = `Tu pedido ${order.id.slice(0, 8).toUpperCase()} ya está registrado. Los datos bancarios todavía requieren configuración interna, así que un responsable de FZAC va a continuar este pago por el chat.`;
      const sent = await sendWhatsAppText(message.from, body);
      await persistAssistantMessage(admin, {
        conversationId: conversation.id,
        content: body,
        providerMessageId: sent.providerMessageId,
        metadata: {
          channel: "WHATSAPP",
          intent: "ecommerce_payment_details_unavailable",
          order_id: order.id,
          delivery_status: sent.status,
          dry_run: config.dryRun
        }
      });
      await admin.from("chat_conversations").update({ status: "WAITING_ADMIN", updated_at: now }).eq("id", conversation.id);
      await admin.from("notifications").insert({
        target_role: "ADMIN",
        type: "WHATSAPP_PAYMENT_CONFIG_REQUIRED",
        title: "Pago de e-commerce requiere atención",
        message: `El pedido ${order.id.slice(0, 8).toUpperCase()} necesita que FZAC envíe los datos bancarios.`,
        link_to: `${getAdminConsolePath()}/pedidos`
      });
      return "PROCESSED";
    }

    const deliveryInstruction = order.shipping_method === "DELIVERY"
      ? " Además, compartí tu ubicación exacta con la función Ubicación de WhatsApp para que podamos coordinar el flete después de validar el pago."
      : " Después de validar el pago coordinamos el retiro por este mismo chat.";
    const body = `Perfecto. Te adjunto el PDF oficial de FZAC con Alias, CVU y titular para el pedido ${order.id.slice(0, 8).toUpperCase()}. Transferí únicamente el total confirmado de $${Math.round(order.total).toLocaleString("es-AR")} y después enviá el comprobante por este chat.${deliveryInstruction}`;
    const sent = await sendWhatsAppText(message.from, body);
    const pdf = createBankTransferPdf({
      details: bank,
      orderReference: order.id.slice(0, 8).toUpperCase(),
      amount: order.total
    });
    const document = await sendWhatsAppDocument(
      message.from,
      pdf,
      `FZAC-datos-transferencia-${order.id.slice(0, 8).toUpperCase()}.pdf`,
      `Datos para transferencia · Pedido ${order.id.slice(0, 8).toUpperCase()}`
    );

    await persistAssistantMessage(admin, {
      conversationId: conversation.id,
      content: body,
      providerMessageId: sent.providerMessageId,
      metadata: {
        channel: "WHATSAPP",
        intent: "ecommerce_payment_details",
        order_id: order.id,
        delivery_status: sent.status,
        document_delivery_status: document.status,
        dry_run: config.dryRun
      }
    });
    if (document.providerMessageId) {
      await persistAssistantMessage(admin, {
        conversationId: conversation.id,
        content: "PDF con datos bancarios de FZAC enviado.",
        providerMessageId: document.providerMessageId,
        messageType: "DOCUMENT",
        metadata: {
          channel: "WHATSAPP",
          intent: "ecommerce_payment_details_document",
          order_id: order.id,
          delivery_status: document.status,
          dry_run: config.dryRun
        }
      });
    }

    const needsAdmin = sent.status === "FAILED" || document.status === "FAILED";
    await admin.from("chat_conversations").update({ status: needsAdmin ? "WAITING_ADMIN" : "OPEN", updated_at: now }).eq("id", conversation.id);
    if (needsAdmin) {
      await admin.from("notifications").insert({
        target_role: "ADMIN",
        type: "WHATSAPP_PAYMENT_DOCUMENT_FAILED",
        title: "No se pudo enviar el PDF de pago",
        message: `Revisá el pedido ${order.id.slice(0, 8).toUpperCase()} y enviá los datos bancarios manualmente.`,
        link_to: `${getAdminConsolePath()}/pedidos`
      });
    }
    return "PROCESSED";
  }

  const unsupported = message.type === "UNSUPPORTED" || (!message.body && !isMedia);
  const reply = unsupported || isMedia
    ? {
        intent: "unsupported",
        message: isMedia
          ? "Recibí el archivo, pero no lo voy a tomar como comprobante porque todavía no está asociado a un pago iniciado. Indicame la referencia del pedido o pedime los datos para pagar."
          : "Por ahora puedo leer mensajes de texto, opciones del menú, ubicaciones e imágenes/documentos vinculados a un pago. Escribime qué producto o gestión necesitás.",
        options: ["Buscar producto", "Hablar con un asesor"],
        handoffRequired: false,
        persistenceText: inboundContent,
        securityNotice: false
      }
    : await createWhatsAppReply(message.body);

  const sendResult = await sendWhatsAppText(message.from, reply.message);
  await persistAssistantMessage(admin, {
    conversationId: conversation.id,
    content: reply.message,
    providerMessageId: sendResult.providerMessageId,
    metadata: {
      channel: "WHATSAPP",
      intent: reply.intent,
      order_id: order?.id ?? null,
      security_notice: reply.securityNotice,
      delivery_status: sendResult.status,
      dry_run: config.dryRun,
      options: reply.options.slice(0, 4)
    }
  });

  const needsAdmin = reply.handoffRequired || sendResult.status === "FAILED";
  const status = needsAdmin ? "WAITING_ADMIN" : "OPEN";
  await admin.from("chat_conversations").update({ status, updated_at: now }).eq("id", conversation.id);
  if (needsAdmin && conversation.status !== "WAITING_ADMIN") {
    await admin.from("notifications").insert({
      target_role: "ADMIN",
      type: "WHATSAPP_WAITING_ADMIN",
      title: "WhatsApp requiere atención",
      message: sendResult.status === "FAILED"
        ? `No se pudo responder al contacto terminado en ${reference.last4}.`
        : `Conversación terminada en ${reference.last4}: ${reply.persistenceText.slice(0, 120)}`,
      link_to: `${getAdminConsolePath()}/chats?conversation=${conversation.id}`
    });
  }
  return "PROCESSED";
}
