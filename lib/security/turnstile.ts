import "server-only";

import { getEnv, getSiteUrl, hasRealValue } from "@/lib/utils/env";

type TurnstileResponse = {
  success?: boolean;
  hostname?: string;
  action?: string;
  ["error-codes"]?: string[];
};

export function isTurnstileConfigured() {
  return hasRealValue(getEnv("TURNSTILE_SECRET_KEY")) && hasRealValue(getEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY"));
}

export async function verifyTurnstileToken(token: string | null | undefined, expectedAction?: string) {
  if (!isTurnstileConfigured()) return { required: false, ok: true, unavailable: false };
  const secret = getEnv("TURNSTILE_SECRET_KEY");
  if (!token || token.length > 4096) return { required: true, ok: false, unavailable: false };

  try {
    const body = new URLSearchParams({ secret, response: token });
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      cache: "no-store",
      signal: AbortSignal.timeout(6_000)
    });

    if (!response.ok) return { required: true, ok: false, unavailable: true };
    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) return { required: true, ok: false, unavailable: false };

    if (expectedAction && result.action !== expectedAction) {
      return { required: true, ok: false, unavailable: false };
    }

    const configuredUrl = getSiteUrl();
    if (result.hostname && configuredUrl && !configuredUrl.includes("localhost")) {
      const expectedHost = new URL(configuredUrl).hostname;
      if (result.hostname !== expectedHost) return { required: true, ok: false, unavailable: false };
    }

    return { required: true, ok: true, unavailable: false };
  } catch {
    return { required: true, ok: false, unavailable: true };
  }
}
