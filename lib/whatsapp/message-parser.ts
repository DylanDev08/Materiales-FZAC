import { z } from "zod";

const messageSchema = z.object({
  from: z.string().max(30),
  id: z.string().min(8).max(180),
  timestamp: z.string().max(30).optional(),
  type: z.string().max(40),
  text: z.object({ body: z.string().max(4096) }).optional(),
  button: z.object({ text: z.string().max(500) }).optional(),
  interactive: z.object({
    button_reply: z.object({ title: z.string().max(500) }).optional(),
    list_reply: z.object({ title: z.string().max(500) }).optional()
  }).optional()
});

const payloadSchema = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(z.object({
    changes: z.array(z.object({
      value: z.object({
        contacts: z.array(z.object({
          wa_id: z.string().max(30).optional(),
          profile: z.object({ name: z.string().max(160).optional() }).optional()
        })).max(50).optional(),
        messages: z.array(messageSchema).max(50).optional()
      }).passthrough()
    }).passthrough()).max(20)
  }).passthrough()).max(20)
});

export type WhatsAppInboundMessage = {
  id: string;
  from: string;
  body: string;
  type: "TEXT" | "BUTTON" | "INTERACTIVE" | "UNSUPPORTED";
  customerName: string | null;
  timestamp: string | null;
};

function bodyFor(message: z.infer<typeof messageSchema>) {
  if (message.type === "text") return message.text?.body ?? "";
  if (message.type === "button") return message.button?.text ?? "";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "";
  }
  return "";
}

function typeFor(value: string): WhatsAppInboundMessage["type"] {
  if (value === "text") return "TEXT";
  if (value === "button") return "BUTTON";
  if (value === "interactive") return "INTERACTIVE";
  return "UNSUPPORTED";
}

export function parseWhatsAppPayload(value: unknown): WhatsAppInboundMessage[] {
  const parsed = payloadSchema.safeParse(value);
  if (!parsed.success) return [];
  const result: WhatsAppInboundMessage[] = [];
  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const contacts = change.value.contacts ?? [];
      for (const message of change.value.messages ?? []) {
        const contact = contacts.find((item) => item.wa_id === message.from) ?? contacts[0];
        result.push({
          id: message.id,
          from: message.from,
          body: bodyFor(message).trim().slice(0, 500),
          type: typeFor(message.type),
          customerName: contact?.profile?.name?.trim().slice(0, 160) || null,
          timestamp: message.timestamp ?? null
        });
      }
    }
  }
  return result;
}
