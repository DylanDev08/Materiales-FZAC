import "server-only";

import { getWhatsAppConfig } from "@/lib/whatsapp/config";

export type WhatsAppSendResult =
  | { status: "DRY_RUN"; providerMessageId: null }
  | { status: "SENT"; providerMessageId: string | null }
  | { status: "FAILED"; providerMessageId: null };

async function sendMessagePayload(to: string, payload: Record<string, unknown>): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();
  if (config.dryRun) return { status: "DRY_RUN", providerMessageId: null };
  if (!config.enabled || !config.canSend) return { status: "FAILED", providerMessageId: null };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7_000);
  try {
    const response = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...payload
      }),
      signal: controller.signal
    });
    if (!response.ok) return { status: "FAILED", providerMessageId: null };
    const body = await response.json() as { messages?: Array<{ id?: string }> };
    return { status: "SENT", providerMessageId: body.messages?.[0]?.id ?? null };
  } catch {
    return { status: "FAILED", providerMessageId: null };
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
  return sendMessagePayload(to, {
    type: "text",
    text: { preview_url: false, body: body.slice(0, 4096) }
  });
}

export async function sendWhatsAppDocument(
  to: string,
  bytes: Uint8Array,
  filename: string,
  caption = ""
): Promise<WhatsAppSendResult> {
  const config = getWhatsAppConfig();
  if (config.dryRun) return { status: "DRY_RUN", providerMessageId: null };
  if (!config.enabled || !config.canSend) return { status: "FAILED", providerMessageId: null };

  const uploadController = new AbortController();
  const uploadTimeout = setTimeout(() => uploadController.abort(), 10_000);
  try {
    const form = new FormData();
    form.set("messaging_product", "whatsapp");
    form.set("type", "application/pdf");
    form.set("file", new Blob([bytes], { type: "application/pdf" }), filename.slice(0, 180));

    const upload = await fetch(`https://graph.facebook.com/${config.version}/${config.phoneNumberId}/media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.accessToken}` },
      body: form,
      signal: uploadController.signal
    });
    if (!upload.ok) return { status: "FAILED", providerMessageId: null };
    const uploaded = await upload.json() as { id?: string };
    if (!uploaded.id) return { status: "FAILED", providerMessageId: null };

    return sendMessagePayload(to, {
      type: "document",
      document: {
        id: uploaded.id,
        filename: filename.slice(0, 180),
        ...(caption.trim() ? { caption: caption.trim().slice(0, 1024) } : {})
      }
    });
  } catch {
    return { status: "FAILED", providerMessageId: null };
  } finally {
    clearTimeout(uploadTimeout);
  }
}
