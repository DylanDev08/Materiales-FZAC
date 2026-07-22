import "server-only";

import { getEnv, hasRealValue } from "@/lib/utils/env";

type TransactionalEmail = {
  to: { email: string; name?: string | null };
  subject: string;
  html: string;
  text: string;
};

export class ResendDeliveryError extends Error {
  constructor() {
    super("No pudimos enviar el email transaccional.");
    this.name = "ResendDeliveryError";
  }
}

export function getResendConfig() {
  const apiKey = getEnv("RESEND_API_KEY");
  const fromEmail = getEnv("RESEND_FROM_EMAIL");
  const fromName = getEnv("RESEND_FROM_NAME") || "Materiales FZAC";
  return {
    apiKey,
    fromEmail,
    fromName,
    configured: hasRealValue(apiKey) && hasRealValue(fromEmail)
  };
}

export function isResendConfigured() {
  return getResendConfig().configured;
}

function formatFromAddress(config: ReturnType<typeof getResendConfig>) {
  return config.fromName ? `${config.fromName} <${config.fromEmail}>` : config.fromEmail;
}

export async function sendTransactionalEmail(input: TransactionalEmail) {
  const config = getResendConfig();
  if (!config.configured) throw new ResendDeliveryError();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: formatFromAddress(config),
        to: [input.to.email],
        subject: input.subject,
        html: input.html,
        text: input.text
      }),
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) throw new ResendDeliveryError();
    return { ok: true };
  } catch (error) {
    if (error instanceof ResendDeliveryError) throw error;
    throw new ResendDeliveryError();
  } finally {
    clearTimeout(timeout);
  }
}
