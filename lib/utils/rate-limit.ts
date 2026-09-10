import "server-only";

import { createHash } from "node:crypto";

type Bucket = {
  count: number;
  resetAt: number;
};

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  blockedBy?: "ip" | "identity";
};

type ConcurrencyBucket = {
  count: number;
  expiresAt: number;
};

type RequestRateLimitOptions = {
  scope: string;
  limit: number;
  windowMs?: number;
  identity?: string | null;
  identityLimit?: number;
  identityWindowMs?: number;
};

type RequestConcurrencyOptions = {
  scope: string;
  identity?: string | null;
  maxGlobal?: number;
  maxPerIp?: number;
  maxPerIdentity?: number;
  leaseMs?: number;
};

export type ConcurrencyLease =
  | { ok: true; retryAfter: 0; release: () => void }
  | { ok: false; retryAfter: number; release: () => void };

const buckets = new Map<string, Bucket>();
const concurrencyBuckets = new Map<string, ConcurrencyBucket>();
const MAX_BUCKETS = 5_000;
const MAX_CONCURRENCY_BUCKETS = 2_000;
let checksSinceSweep = 0;
let concurrencyChecksSinceSweep = 0;

function sweepBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size <= MAX_BUCKETS) return;
  const overflow = buckets.size - MAX_BUCKETS;
  const oldest = [...buckets.entries()].sort(([, left], [, right]) => left.resetAt - right.resetAt).slice(0, overflow);
  oldest.forEach(([key]) => buckets.delete(key));
}

function sweepConcurrencyBuckets(now: number) {
  for (const [key, bucket] of concurrencyBuckets) {
    if (bucket.expiresAt <= now || bucket.count <= 0) concurrencyBuckets.delete(key);
  }

  if (concurrencyBuckets.size <= MAX_CONCURRENCY_BUCKETS) return;
  const overflow = concurrencyBuckets.size - MAX_CONCURRENCY_BUCKETS;
  const oldest = [...concurrencyBuckets.entries()]
    .sort(([, left], [, right]) => left.expiresAt - right.expiresAt)
    .slice(0, overflow);
  oldest.forEach(([key]) => concurrencyBuckets.delete(key));
}

function safeLimit(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

function safeWindow(value: number, fallback: number) {
  return Number.isFinite(value) ? Math.max(1_000, Math.floor(value)) : fallback;
}

function identityHash(identity: string) {
  return createHash("sha256").update(identity.trim().toLowerCase()).digest("hex").slice(0, 24);
}

export function rateLimit(key: string, limit = 30, windowMs = 60_000): RateLimitResult {
  const normalizedLimit = safeLimit(limit, 30);
  const normalizedWindow = safeWindow(windowMs, 60_000);
  const now = Date.now();
  checksSinceSweep += 1;
  if (checksSinceSweep >= 128 || buckets.size > MAX_BUCKETS) {
    sweepBuckets(now);
    checksSinceSweep = 0;
  }
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    const resetAt = now + normalizedWindow;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: normalizedLimit - 1, resetAt, retryAfter: 0 };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    ok: current.count <= normalizedLimit,
    remaining: Math.max(0, normalizedLimit - current.count),
    resetAt: current.resetAt,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000))
  };
}

export function rateLimitRequest(request: Request, options: RequestRateLimitOptions): RateLimitResult {
  const windowMs = options.windowMs ?? 60_000;
  const ipResult = rateLimit(getRequestKey(request, `${options.scope}:ip`), options.limit, windowMs);
  const identity = options.identity?.trim();

  if (!identity) return { ...ipResult, blockedBy: ipResult.ok ? undefined : "ip" };

  const identityResult = rateLimit(
    `${options.scope}:identity:${identityHash(identity)}`,
    options.identityLimit ?? options.limit,
    options.identityWindowMs ?? windowMs
  );
  if (!ipResult.ok || !identityResult.ok) {
    const blockedBy = !identityResult.ok ? "identity" : "ip";
    const blocked = blockedBy === "identity" ? identityResult : ipResult;
    return { ...blocked, blockedBy };
  }

  return identityResult.remaining <= ipResult.remaining
    ? { ...identityResult, blockedBy: undefined }
    : { ...ipResult, blockedBy: undefined };
}

export function rateLimitIdentity(scope: string, identity: string, limit = 30, windowMs = 60_000) {
  return rateLimit(`${scope}:identity:${identityHash(identity)}`, limit, windowMs);
}

function acquireConcurrencyBucket(key: string, max: number, leaseMs: number): ConcurrencyLease {
  const now = Date.now();
  concurrencyChecksSinceSweep += 1;
  if (concurrencyChecksSinceSweep >= 64 || concurrencyBuckets.size > MAX_CONCURRENCY_BUCKETS) {
    sweepConcurrencyBuckets(now);
    concurrencyChecksSinceSweep = 0;
  }

  const normalizedMax = safeLimit(max, 1);
  const normalizedLease = safeWindow(leaseMs, 30_000);
  const existing = concurrencyBuckets.get(key);
  const current = !existing || existing.expiresAt <= now ? { count: 0, expiresAt: now + normalizedLease } : existing;

  if (current.count >= normalizedMax) {
    return {
      ok: false,
      retryAfter: Math.max(1, Math.ceil((current.expiresAt - now) / 1_000)),
      release: () => undefined
    };
  }

  current.count += 1;
  current.expiresAt = now + normalizedLease;
  concurrencyBuckets.set(key, current);
  let released = false;

  return {
    ok: true,
    retryAfter: 0,
    release: () => {
      if (released) return;
      released = true;
      const active = concurrencyBuckets.get(key);
      if (!active) return;
      active.count -= 1;
      if (active.count <= 0) concurrencyBuckets.delete(key);
      else concurrencyBuckets.set(key, active);
    }
  };
}

export function acquireRequestConcurrency(request: Request, options: RequestConcurrencyOptions): ConcurrencyLease {
  const leaseMs = options.leaseMs ?? 30_000;
  const leases: ConcurrencyLease[] = [];
  const keys: Array<[string, number]> = [
    [`${options.scope}:concurrency:global`, options.maxGlobal ?? 20],
    [getRequestKey(request, `${options.scope}:concurrency:ip`), options.maxPerIp ?? 2]
  ];
  const identity = options.identity?.trim();
  if (identity) {
    keys.push([
      `${options.scope}:concurrency:identity:${identityHash(identity)}`,
      options.maxPerIdentity ?? 1
    ]);
  }

  for (const [key, max] of keys) {
    const lease = acquireConcurrencyBucket(key, max, leaseMs);
    if (!lease.ok) {
      leases.forEach((active) => active.release());
      return lease;
    }
    leases.push(lease);
  }

  let released = false;
  return {
    ok: true,
    retryAfter: 0,
    release: () => {
      if (released) return;
      released = true;
      leases.forEach((lease) => lease.release());
    }
  };
}

export function retryAfterHeaders(result: Pick<RateLimitResult, "retryAfter" | "remaining" | "resetAt"> | { retryAfter: number }) {
  const headers: Record<string, string> = {
    "Retry-After": String(Math.max(1, result.retryAfter)),
    "Cache-Control": "private, no-store"
  };
  if ("remaining" in result) headers["X-RateLimit-Remaining"] = String(Math.max(0, result.remaining));
  if ("resetAt" in result) headers["X-RateLimit-Reset"] = String(Math.ceil(result.resetAt / 1_000));
  return headers;
}

function normalizeClientAddress(value: string | null | undefined) {
  const address = value?.trim().slice(0, 64) ?? "";
  return /^[0-9a-f:.]+$/i.test(address) ? address.toLowerCase() : "unknown";
}

export function getRequestKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = normalizeClientAddress(
    request.headers.get("x-real-ip") || request.headers.get("cf-connecting-ip") || forwarded
  );
  return `${scope}:${ip}`;
}
