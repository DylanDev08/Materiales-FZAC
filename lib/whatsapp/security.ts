import { createHmac, timingSafeEqual } from "node:crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function verifyWebhookToken(received: string | null, expected: string) {
  if (!received || !expected) return false;
  return safeEqual(received, expected);
}

export function verifyMetaSignature(rawBody: string, signature: string | null, appSecret: string) {
  if (!rawBody || !signature || !appSecret || !/^sha256=[0-9a-f]{64}$/i.test(signature)) return false;
  const expected = `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
  return safeEqual(signature.toLowerCase(), expected.toLowerCase());
}

export function normalizeWhatsAppPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return /^\d{8,15}$/.test(digits) ? digits : "";
}

export function privatePhoneReference(phone: string, secret: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized || !secret) return null;
  return {
    hash: createHmac("sha256", secret).update(normalized, "utf8").digest("hex"),
    last4: normalized.slice(-4)
  };
}
