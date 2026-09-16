import "server-only";

import { randomUUID } from "node:crypto";

type DistributedLock =
  | { status: "acquired"; release: () => Promise<void> }
  | { status: "contended" | "unavailable"; release: () => Promise<void> };

const RELEASE_SCRIPT = [
  "if redis.call('GET', KEYS[1]) == ARGV[1] then",
  "  return redis.call('DEL', KEYS[1])",
  "end",
  "return 0"
].join("\n");

async function command(url: string, token: string, body: unknown, timeoutMs = 1_200) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json() as { result?: unknown; error?: unknown };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function acquireDistributedLock(name: string, leaseMs: number): Promise<DistributedLock> {
  const rawUrl = process.env.UPSTASH_REDIS_REST_URL?.trim() ?? "";
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim() ?? "";
  if (!rawUrl || !token || !/^https:\/\//i.test(rawUrl)) {
    return { status: "unavailable", release: async () => undefined };
  }

  const url = rawUrl.replace(/\/+$/, "");
  const lockKey = `fzac:lock:${name.replace(/[^a-z0-9:_-]/gi, "_").slice(0, 80)}`;
  const owner = randomUUID();
  const result = await command(url, token, ["SET", lockKey, owner, "NX", "PX", Math.max(1_000, leaseMs)]);
  if (!result || result.error) return { status: "unavailable", release: async () => undefined };
  if (result.result !== "OK") return { status: "contended", release: async () => undefined };

  let released = false;
  return {
    status: "acquired",
    release: async () => {
      if (released) return;
      released = true;
      await command(url, token, ["EVAL", RELEASE_SCRIPT, "1", lockKey, owner]);
    }
  };
}
