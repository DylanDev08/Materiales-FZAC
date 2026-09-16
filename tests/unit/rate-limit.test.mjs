import assert from "node:assert/strict";
import test from "node:test";
import { checkDistributedRateLimit } from "../../lib/utils/distributed-rate-limit.ts";

function response(result, ok = true) {
  return {
    ok,
    json: async () => result
  };
}

test("rate limit distribuido permite solicitudes dentro de la ventana", async () => {
  let requestBody = null;
  const result = await checkDistributedRateLimit({
    url: "https://redis.example.invalid",
    token: "test-token",
    redisKey: "fzac:ratelimit:hashed",
    limit: 5,
    windowMs: 60_000,
    timeoutMs: 100,
    now: () => 1_000,
    fetch: async (_url, init) => {
      requestBody = JSON.parse(String(init?.body));
      return response({ result: [2, 25_000] });
    }
  });

  assert.equal(result?.ok, true);
  assert.equal(result?.remaining, 3);
  assert.equal(result?.resetAt, 26_000);
  assert.equal(requestBody[0], "EVAL");
  assert.equal(requestBody[3], "fzac:ratelimit:hashed");
});

test("rate limit distribuido bloquea al superar el limite", async () => {
  const result = await checkDistributedRateLimit({
    url: "https://redis.example.invalid",
    token: "test-token",
    redisKey: "fzac:ratelimit:hashed",
    limit: 3,
    windowMs: 60_000,
    timeoutMs: 100,
    now: () => 1_000,
    fetch: async () => response({ result: [4, 2_100] })
  });

  assert.deepEqual(result, {
    ok: false,
    remaining: 0,
    resetAt: 3_100,
    retryAfter: 3,
    backend: "upstash"
  });
});

test("rate limit distribuido devuelve null ante fallo para habilitar fallback local", async () => {
  const invalid = await checkDistributedRateLimit({
    url: "https://redis.example.invalid",
    token: "test-token",
    redisKey: "fzac:ratelimit:hashed",
    limit: 3,
    windowMs: 60_000,
    timeoutMs: 100,
    fetch: async () => response({ error: "unavailable" })
  });
  const failed = await checkDistributedRateLimit({
    url: "https://redis.example.invalid",
    token: "test-token",
    redisKey: "fzac:ratelimit:hashed",
    limit: 3,
    windowMs: 60_000,
    timeoutMs: 100,
    fetch: async () => { throw new Error("network"); }
  });

  assert.equal(invalid, null);
  assert.equal(failed, null);
});
