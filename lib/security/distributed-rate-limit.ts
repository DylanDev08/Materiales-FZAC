import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestKey } from "@/lib/utils/rate-limit";

export type DistributedRateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfter: number;
  resetAt: number;
  degraded?: boolean;
  blockedBy?: "ip" | "identity";
};

type Options = {
  scope: string;
  limit: number;
  windowMs?: number;
  identity?: string | null;
  identityLimit?: number;
  identityWindowMs?: number;
};

function digest(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

async function consume(scope: string, subject: string, limit: number, windowMs: number): Promise<DistributedRateLimitResult> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { ok: true, remaining: limit, retryAfter: 0, resetAt: Date.now(), degraded: true };
  }

  const { data, error } = await admin.rpc("consume_security_rate_limit", {
    p_scope: scope,
    p_subject_hash: digest(subject),
    p_limit: Math.max(1, Math.floor(limit)),
    p_window_seconds: Math.max(1, Math.ceil(windowMs / 1000))
  });

  if (error) {
    console.error("[distributed-rate-limit]", { scope, code: error.code ?? null });
    return { ok: true, remaining: limit, retryAfter: 0, resetAt: Date.now(), degraded: true };
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    ok: result.ok !== false,
    remaining: Number(result.remaining ?? 0),
    retryAfter: Number(result.retry_after ?? 0),
    resetAt: Number(result.reset_at ?? 0) * 1000
  };
}

export async function distributedRateLimitRequest(request: Request, options: Options): Promise<DistributedRateLimitResult> {
  const windowMs = options.windowMs ?? 60_000;
  const ip = await consume(
    options.scope + ":ip",
    getRequestKey(request, options.scope + ":distributed"),
    options.limit,
    windowMs
  );

  if (!ip.ok) return { ...ip, blockedBy: "ip" };

  const identity = options.identity?.trim();
  if (!identity) return ip;

  const identityResult = await consume(
    options.scope + ":identity",
    identity,
    options.identityLimit ?? options.limit,
    options.identityWindowMs ?? windowMs
  );

  if (!identityResult.ok) return { ...identityResult, blockedBy: "identity" };

  return identityResult.remaining <= ip.remaining ? identityResult : ip;
}

export function distributedRetryHeaders(result: DistributedRateLimitResult) {
  const headers: Record<string, string> = {
    "Retry-After": String(Math.max(1, result.retryAfter || 1)),
    "Cache-Control": "private, no-store"
  };
  if (Number.isFinite(result.remaining)) headers["X-RateLimit-Remaining"] = String(Math.max(0, result.remaining));
  if (Number.isFinite(result.resetAt) && result.resetAt > 0) {
    headers["X-RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1000));
  }
  return headers;
}
