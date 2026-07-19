type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5_000;
let checksSinceSweep = 0;

function sweepBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size <= MAX_BUCKETS) return;
  const overflow = buckets.size - MAX_BUCKETS;
  const oldest = [...buckets.entries()].sort(([, left], [, right]) => left.resetAt - right.resetAt).slice(0, overflow);
  oldest.forEach(([key]) => buckets.delete(key));
}

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  checksSinceSweep += 1;
  if (checksSinceSweep >= 128 || buckets.size > MAX_BUCKETS) {
    sweepBuckets(now);
    checksSinceSweep = 0;
  }
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    const resetAt = now + windowMs;
    buckets.set(key, { count: 1, resetAt });
    return { ok: true, remaining: limit - 1, resetAt, retryAfter: 0 };
  }

  current.count += 1;
  buckets.set(key, current);

  return {
    ok: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    resetAt: current.resetAt,
    retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1_000))
  };
}

export function retryAfterHeaders(result: { retryAfter: number }) {
  return { "Retry-After": String(Math.max(1, result.retryAfter)) };
}

export function getRequestKey(request: Request, scope: string) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
