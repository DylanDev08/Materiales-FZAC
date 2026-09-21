import "server-only";

import { getAdminConsolePath } from "@/lib/utils/env";
import { distributedRateLimitIdentity } from "@/lib/utils/rate-limit";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import type { WhatsAppInboundMessage } from "@/lib/whatsapp/message-parser";
import { createWhatsAppReply } from "@/lib/whatsapp/responder";
import { privatePhoneReference } from "@/lib/whatsapp/security";

type ProcessingResult = "PROCESSED" | "DUPLICATE" | "RATE_LIMITED" | "UNAVAILABLE" | "INVALID";

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

export async function processWhatsAppMessage(message: WhatsAppInboundMessage): Promise<ProcessingResult> {
  const config = getWhatsAppConfig();
  const reference = privatePhoneReference(message.from, config.appSecret);
  if (!reference || !message.id) return "INVALID";
  const rate = await distributedRateLimitIdentity("whatsapp-webhook", reference.hash, 18, 60_000);
  if (!rate.ok) return "RATE_LIMITED";
  const admin = getSupabaseAdminClient();
  if (!admin) return "UNAVAILABLE";

  const { data: duplicate } = await admin.from("chat_messages").select("id").eq("external_message_id", message.id).maybeSingle();
  if (duplicate) return "DUPLICATE";

  const conversation = await findOrCreateConversation({
    hash: reference.hash,
    last4: reference.last4,
    name: message.customerName,
    subject: message.body || "Mensaje de WhatsApp"
  });
  if (!conversation?.id) return "UNAVAILABLE";

  const unsupported = message.type === "UNSUPPORTED" || !message.body;
  const reply = unsupported
    ? {
        intent: "unsupported",
        message: "Por ahora puedo leer mensajes de texto y opciones del menú. Escribime qué producto o gestión necesitás.",
        options: ["Buscar producto", "Hablar con un asesor"],
        handoffRequired: false,
        persistenceText: "[mensaje no textual]",
        securityNotice: false
      }
    : await createWhatsAppReply(message.body);

  const now = new Date().toISOString();
  const { error: inboundError } = await admin.from("chat_messages").insert({
    conversation_id: conversation.id,
    role: "USER",
    content: reply.persistenceText,
    external_message_id: message.id,
    direction: "INBOUND",
    message_type: message.type,
    metadata: {
      channel: "WHATSAPP",
      intent: reply.intent,
      security_notice: reply.securityNotice,
      provider_timestamp: message.timestamp
    }
  });
  if (inboundError) return inboundError.code === "23505" ? "DUPLICATE" : "UNAVAILABLE";

  const sendResult = await sendWhatsAppText(message.from, reply.message);
  await admin.from("chat_messages").insert({
    conversation_id: conversation.id,
    role: "ASSISTANT",
    content: reply.message,
    external_message_id: sendResult.providerMessageId,
    direction: "OUTBOUND",
    message_type: "TEXT",
    metadata: {
      channel: "WHATSAPP",
      intent: reply.intent,
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
