import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { validateMercadoPagoSignature } from "../../lib/payments/mercadopago-signature.ts";
import {
  buildMercadoPagoProviderEventId,
  mercadoPagoWebhookAction,
  orderStatusFromMercadoPago,
  paymentAmountMatchesLocal,
  paymentStatusFromMercadoPago,
  safeWebhookEvent
} from "../../lib/payments/mercadopago-webhook-policy.ts";

test("a signed notification is bound to its payment ID, request ID and secret", () => {
  const input = {
    webhookSecret: "unit-test-webhook-secret", paymentsEnv: "production", dataId: "123456",
    xRequestId: "unit-request", xSignature: ""
  };
  const ts = "1793100000";
  const digest = crypto.createHmac("sha256", input.webhookSecret)
    .update(`id:${input.dataId};request-id:${input.xRequestId};ts:${ts};`).digest("hex");
  input.xSignature = `ts=${ts},v1=${digest}`;
  assert.equal(validateMercadoPagoSignature(input), true);
  for (const tampering of [
    { dataId: "999999" }, { xRequestId: "other-request" }, { webhookSecret: "other-secret" },
    { xSignature: `ts=${ts},v1=invalid` }, { xSignature: `ts=${ts},v1=ab` }, { xSignature: null }
  ]) assert.equal(validateMercadoPagoSignature({ ...input, ...tampering }), false);
  assert.equal(validateMercadoPagoSignature({ ...input, webhookSecret: "" }), false);
});

test("only approved payments request confirmation; pending and unknown events remain pending", () => {
  assert.equal(mercadoPagoWebhookAction("approved"), "CONFIRM");
  assert.equal(paymentStatusFromMercadoPago("approved"), "PAID");
  for (const status of ["pending", "in_process", "authorized", "unknown"]) {
    assert.equal(mercadoPagoWebhookAction(status), "UPDATE");
    assert.equal(paymentStatusFromMercadoPago(status), "PENDING");
    assert.equal(orderStatusFromMercadoPago(status), "PENDING_PAYMENT");
  }
  for (const status of ["rejected", "cancelled"]) assert.equal(paymentStatusFromMercadoPago(status), "FAILED");
  assert.equal(paymentStatusFromMercadoPago("expired"), "EXPIRED");
});

test("full refunds and chargebacks request reversal; partial refunds require manual review", () => {
  for (const status of ["refunded", "charged_back"]) {
    assert.equal(mercadoPagoWebhookAction(status), "REFUND");
    assert.equal(paymentStatusFromMercadoPago(status), "REFUNDED");
    assert.equal(orderStatusFromMercadoPago(status), "CANCELLED");
  }
  assert.equal(mercadoPagoWebhookAction("partially_refunded"), "MANUAL_REVIEW");
});

test("payment reconciliation refuses mismatched amounts, currencies and invalid numbers", () => {
  const local = { amount: "40000.00", currency: "ARS" };
  assert.equal(paymentAmountMatchesLocal({ transaction_amount: 40000, currency_id: "ARS" }, local), true);
  for (const remote of [
    { transaction_amount: 39999, currency_id: "ARS" },
    { transaction_amount: 40000, currency_id: "USD" },
    { transaction_amount: "invalid", currency_id: "ARS" },
    { transaction_amount: Infinity, currency_id: "ARS" }
  ]) assert.equal(paymentAmountMatchesLocal(remote, local), false);
});

test("notification retries preserve identity without treating all payment updates as one event", () => {
  const event = { id: "notification-1", data: { id: "123456" } };
  assert.equal(buildMercadoPagoProviderEventId(event, "request-a"), buildMercadoPagoProviderEventId(event, "request-b"));
  assert.notEqual(buildMercadoPagoProviderEventId(event, null), buildMercadoPagoProviderEventId({ ...event, id: "notification-2" }, null));
  assert.equal(buildMercadoPagoProviderEventId({ id: "123456", data: { id: "123456" } }, null), null);
  assert.equal(buildMercadoPagoProviderEventId({}, "retry-request"), "request:retry-request");
});

test("stored notification summaries discard payer data and arbitrary payload fields", () => {
  const safe = safeWebhookEvent({
    id: 10, type: "payment", data: { id: 123456, payer: { email: "private@example.invalid" } },
    access_token: "private-token", payer: { email: "private@example.invalid" }
  });
  assert.deepEqual(safe.data, { id: "123456" });
  assert.doesNotMatch(JSON.stringify(safe), /private|access_token|payer/);
});
