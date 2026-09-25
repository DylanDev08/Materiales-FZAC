import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/utils/env";

export const OAUTH_LEGAL_INTENT_COOKIE = "fzac_oauth_legal_intent";
const INTENT_TTL_SECONDS = 10 * 60;

function signingKey() {
  const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  return serviceRoleKey ? createHmac("sha256", serviceRoleKey).update("fzac-oauth-legal-intent-v1").digest() : null;
}

function signature(payload: string, key: Buffer) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function createOAuthLegalIntent() {
  const key = signingKey();
  if (!key) return null;
  const payload = `${Math.floor(Date.now() / 1000)}.${randomBytes(24).toString("base64url")}`;
  return `${payload}.${signature(payload, key)}`;
}

export function verifyOAuthLegalIntent(token: string | undefined) {
  const key = signingKey();
  if (!key || !token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [issuedAtRaw, nonce, supplied] = parts;
  if (!/^\d{10}$/.test(issuedAtRaw) || !/^[A-Za-z0-9_-]{32}$/.test(nonce) || !/^[a-f0-9]{64}$/.test(supplied)) {
    return false;
  }
  const issuedAt = Number(issuedAtRaw);
  const age = Math.floor(Date.now() / 1000) - issuedAt;
  if (!Number.isFinite(age) || age < 0 || age > INTENT_TTL_SECONDS) return false;
  const expected = signature(`${issuedAtRaw}.${nonce}`, key);
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(supplied, "hex"));
}

export function readOAuthLegalIntentCookie(cookieHeader: string | null) {
  const entry = String(cookieHeader ?? "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OAUTH_LEGAL_INTENT_COOKIE}=`));
  if (!entry) return undefined;
  try {
    return decodeURIComponent(entry.slice(OAUTH_LEGAL_INTENT_COOKIE.length + 1));
  } catch {
    return undefined;
  }
}
