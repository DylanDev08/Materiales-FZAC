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
  }).optional(),
  image: z.object({
    id: z.string().max(220),
    mime_type: z.string().max(120).optional(),
    caption: z.string().max(2000).optional()
  }).optional(),
  document: z.object({
    id: z.string().max(220),
    mime_type: z.string().max(120).optional(),
    filename: z.string().max(240).optional(),
    caption: z.string().max(2000).optional()
  }).optional(),
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    name: z.string().max(500).optional(),
    address: z.string().max(1000).optional()
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
  type: "TEXT" | "BUTTON" | "INTERACTIVE" | "IMAGE" | "DOCUMENT" | "LOCATION" | "UNSUPPORTED";
  customerName: string | null;
  timestamp: string | null;
  mediaId: string | null;
  mimeType: string | null;
  filename: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  locationAddress: string | null;
};

function bodyFor(message: z.infer<typeof messageSchema>) {
  if (message.type === "text") return message.text?.body ?? "";
  if (message.type === "button") return message.button?.text ?? "";
  if (message.type === "interactive") {
    return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? "";
  }
  if (message.type === "image") return message.image?.caption ?? "";
  if (message.type === "document") return message.document?.caption ?? message.document?.filename ?? "";
  if (message.type === "location") {
    const location = message.location;
    return [location?.name, location?.address].filter(Boolean).join(" - ");
  }
  return "";
}

function typeFor(value: string): WhatsAppInboundMessage["type"] {
  if (value === "text") return "TEXT";
  if (value === "button") return "BUTTON";
  if (value === "interactive") return "INTERACTIVE";
  if (value === "image") return "IMAGE";
  if (value === "document") return "DOCUMENT";
  if (value === "location") return "LOCATION";
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
          timestamp: message.timestamp ?? null,
          mediaId: message.image?.id ?? message.document?.id ?? null,
          mimeType: message.image?.mime_type ?? message.document?.mime_type ?? null,
          filename: message.document?.filename ?? null,
          latitude: message.location?.latitude ?? null,
          longitude: message.location?.longitude ?? null,
          locationName: message.location?.name?.trim().slice(0, 500) || null,
          locationAddress: message.location?.address?.trim().slice(0, 1000) || null
        });
      }
    }
  }
  return result;
}
