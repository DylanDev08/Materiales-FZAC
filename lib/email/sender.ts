import "server-only";

import { getEnv, hasRealValue } from "@/lib/utils/env";

type TransactionalEmail = {
  to: { email: string; name?: string | null };
  subject: string;
  html: string;
  text: string;
};

export class SenderDeliveryError extends Error {
  constructor() {
    super("No pudimos enviar el email transaccional.");
    this.name = "SenderDeliveryError";
  }
}

export function getSenderConfig() {
  const apiKey = getEnv("SENDER_API_KEY");
  const fromEmail = getEnv("SENDER_FROM_EMAIL");
  const fromName = getEnv("SENDER_FROM_NAME") || "Materiales FZAC";
  return {
    apiKey,
    fromEmail,
    fromName,
    configured: hasRealValue(apiKey) && hasRealValue(fromEmail)
  };
}

export function isSenderConfigured() {
  return getSenderConfig().configured;
}

export async function sendTransactionalEmail(input: TransactionalEmail) {
  const config = getSenderConfig();
  if (!config.configured) throw new SenderDeliveryError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch("https://api.sender.net/v2/message/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        from: { email: config.fromEmail, name: config.fromName },
        to: { email: input.to.email, name: input.to.name || input.to.email },
        subject: input.subject,
        html: input.html,
        text: input.text
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) throw new SenderDeliveryError();
    return { ok: true };
  } catch (error) {
    if (error instanceof SenderDeliveryError) throw error;
    throw new SenderDeliveryError();
  } finally {
    clearTimeout(timeout);
  }
}
