import "server-only";

import { createHash } from "node:crypto";
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

function hasHeaderInjection(value: string) {
  return /[\r\n]/.test(value);
}

export async function sendTransactionalEmail(input: TransactionalEmail) {
  const config = getResendConfig();
  if (!config.configured) throw new ResendDeliveryError();
  if (
    hasHeaderInjection(input.to.email) ||
    hasHeaderInjection(input.subject) ||
    hasHeaderInjection(config.fromEmail) ||
    hasHeaderInjection(config.fromName)
  ) throw new ResendDeliveryError();

  const body = JSON.stringify({
    from: formatFromAddress(config),
    to: [input.to.email],
    subject: input.subject,
    html: input.html,
    text: input.text
  });
  const idempotencyKey = `fzac/${createHash("sha256").update(`${input.to.email}\n${input.subject}\n${input.text}`).digest("hex")}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body,
        signal: controller.signal,
        cache: "no-store"
      });
      if (response.ok) return { ok: true };
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) continue;
      throw new ResendDeliveryError();
    } catch (error) {
      if (attempt === 0 && !(error instanceof ResendDeliveryError)) continue;
      throw new ResendDeliveryError();
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ResendDeliveryError();
}
