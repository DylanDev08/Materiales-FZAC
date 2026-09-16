export type DistributedRateLimitResult = {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number;
  backend: "upstash";
};

export type DistributedRateLimitInput = {
  url: string;
  token: string;
  redisKey: string;
  limit: number;
  windowMs: number;
  timeoutMs: number;
  now?: () => number;
  fetch?: typeof fetch;
};

const FIXED_WINDOW_SCRIPT = [
  "local current = redis.call('INCR', KEYS[1])",
  "if current == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
  "local ttl = redis.call('PTTL', KEYS[1])",
  "return {current, ttl}"
].join("\n");

export async function checkDistributedRateLimit(
  input: DistributedRateLimitInput
): Promise<DistributedRateLimitResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    const response = await (input.fetch ?? fetch)(input.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(["EVAL", FIXED_WINDOW_SCRIPT, "1", input.redisKey, String(input.windowMs)]),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { result?: unknown; error?: unknown };
    if (payload.error || !Array.isArray(payload.result) || payload.result.length < 2) return null;

    const count = Number(payload.result[0]);
    const ttl = Number(payload.result[1]);
    if (!Number.isFinite(count) || !Number.isFinite(ttl) || ttl < 0) return null;
    const resetAt = (input.now?.() ?? Date.now()) + ttl;
    return {
      ok: count <= input.limit,
      remaining: Math.max(0, input.limit - count),
      resetAt,
      retryAfter: count <= input.limit ? 0 : Math.max(1, Math.ceil(ttl / 1_000)),
      backend: "upstash"
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
