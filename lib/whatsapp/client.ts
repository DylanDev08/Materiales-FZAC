import "server-only";

import { getWhatsAppConfig } from "@/lib/whatsapp/config";

export type WhatsAppSendResult =
  | { status: "DRY_RUN"; providerMessageId: null }
  | { status: "SENT"; providerMessageId: string | null }
  | { status: "FAILED"; providerMessageId: null };

export async function sendWhatsAppText(to: string, body: string): Promise<WhatsAppSendResult> {
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
        type: "text",
        text: { preview_url: false, body: body.slice(0, 4096) }
      }),
      signal: controller.signal
    });
    if (!response.ok) return { status: "FAILED", providerMessageId: null };
    const payload = await response.json() as { messages?: Array<{ id?: string }> };
    return { status: "SENT", providerMessageId: payload.messages?.[0]?.id ?? null };
  } catch {
    return { status: "FAILED", providerMessageId: null };
  } finally {
    clearTimeout(timeout);
  }
}
