import assert from "node:assert/strict";
import test from "node:test";
import { assertCheckoutQaRuntime, assertCheckoutQaTarget } from "../../scripts/lib/checkout-qa-safety.mjs";

const confirmedTest = { PAYMENTS_ENV: "test", QA_CONFIRM_MUTATING_CHECKOUT: "I_UNDERSTAND" };

test("a local frontend still needs explicit authorization for database mutations", () => {
  assert.throws(() => assertCheckoutQaTarget("http://127.0.0.1:3000", { PAYMENTS_ENV: "test" }), /QA_CONFIRM/);
  assert.doesNotThrow(() => assertCheckoutQaTarget("http://127.0.0.1:3000", confirmedTest));
});

test("remote QA requires opt-in and HTTPS and cannot use the production storefront", () => {
  assert.throws(() => assertCheckoutQaTarget("https://staging.example.com", confirmedTest), /Remote checkout/);
  const remote = { ...confirmedTest, ALLOW_REMOTE_CHECKOUT_QA: "true" };
  assert.doesNotThrow(() => assertCheckoutQaTarget("https://staging.example.com", remote));
  for (const target of ["http://staging.example.com", "https://fzacmateriales.store", "https://www.fzacmateriales.store", "https://www.fzacmateriales.store."]) {
    assert.throws(() => assertCheckoutQaTarget(target, remote));
  }
});

test("production flags and ambiguous target URLs fail before contacting any service", () => {
  for (const override of [{ PAYMENTS_ENV: "production" }, { PAYMENTS_ENV: "" }, { PAYMENTS_PRODUCTION_CONFIRMED: "true" }]) {
    assert.throws(() => assertCheckoutQaTarget("http://localhost:3000", { ...confirmedTest, ...override }), /explicit test/);
  }
  for (const target of ["http://user:password@localhost:3000", "http://localhost:3000/api", "http://localhost:3000?next=x"]) {
    assert.throws(() => assertCheckoutQaTarget(target, confirmedTest), /origin/);
  }
});

test("local test flags do not authorize a proxy that reports production or unavailable payments", async () => {
  for (const status of [
    { provider: "MERCADOPAGO", environment: "production", enabled: true },
    { provider: "MERCADOPAGO", environment: "test", enabled: false },
    { environment: "test", enabled: true },
    {}
  ]) {
    await assert.rejects(assertCheckoutQaRuntime("http://localhost:3000", async () => Response.json(status)), /effective checkout/);
  }
  await assert.rejects(assertCheckoutQaRuntime("http://localhost:3000", async () => new Response("down", { status: 503 })), /Could not verify/);
  await assert.rejects(assertCheckoutQaRuntime("http://localhost:3000", async () => new Response("not json")));
});

test("test runtime preflight requests only status and refuses redirects", async () => {
  const status = { provider: "MERCADOPAGO", environment: "test", enabled: true };
  const result = await assertCheckoutQaRuntime("http://localhost:3000", async (url, options) => {
    assert.equal(url, "http://localhost:3000/api/payments/mercadopago");
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);
    return Response.json(status);
  });
  assert.deepEqual(result, status);
  await assert.rejects(assertCheckoutQaRuntime("http://localhost:3000", async () => { throw new Error("network down"); }), /network down/);
});
