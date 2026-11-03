import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const orders = readFileSync(new URL("../../lib/db/orders.ts", import.meta.url), "utf8");
const checkout = readFileSync(new URL("../../components/checkout/checkout-form.tsx", import.meta.url), "utf8");

test("large purchases are handled before transfer instructions", () => {
  const createdOrderBranch = orders.split("const reservationExpiresAt = atomic.reservation_expires_at ?? null;")[1];
  assert.ok(createdOrderBranch, "the persisted checkout branch must exist");
  const approvalPosition = createdOrderBranch.indexOf("if (requiresAdminApproval) {");
  const transferPosition = createdOrderBranch.indexOf("if (isBankTransfer) {");
  assert.ok(approvalPosition >= 0 && transferPosition > approvalPosition,
    "approval must precede the transfer-pending response");
  const approvalBranch = createdOrderBranch.slice(approvalPosition, transferPosition);
  assert.match(approvalBranch, /requiresAdminApproval:\s*true/);
  assert.match(approvalBranch, /notifyAdminLargePurchase/);
  assert.doesNotMatch(approvalBranch, /notifyAdminTransferPending/);
});

test("bank transfer confirmation routes to approval when required", () => {
  assert.match(checkout, /requires_admin_approval\?: boolean/);
  assert.match(checkout, /data\.requires_admin_approval\s*\?\s*"approval=1"\s*:\s*"transfer=1"/);
  assert.match(checkout, /encodeURIComponent\(orderId\)/);
});

const validations = readFileSync(new URL("../../lib/validations/checkout.ts", import.meta.url), "utf8");

test("omitted payment method never defaults to Mercado Pago", () => {
  assert.match(orders, /const paymentMethod = payload\.paymentMethod \?\? "BANK_TRANSFER"/);
  assert.doesNotMatch(orders, /const paymentMethod = payload\.paymentMethod \?\? "MERCADOPAGO"/);
  assert.match(validations, /value\.payment_flow === "CARD" \|\| value\.payment_flow === "CHECKOUT_PRO" \? "MERCADOPAGO" : "BANK_TRANSFER"/);
  assert.match(validations, /=== "BANK_TRANSFER" \? "TRANSFER" : "CHECKOUT_PRO"/);
});

test("checkout starts with transfer selected", () => {
  assert.match(checkout, /useState<PaymentMode>\("BANK_TRANSFER"\)/);
  assert.match(checkout, /current === "CARD_BRICK" \? "BANK_TRANSFER" : current/);
});

test("disabled online payments are hidden and transfer remains available", () => {
  assert.match(checkout, /const mercadoPagoReady = data\.enabled === true/);
  assert.match(checkout, /setRuntimeMercadoPagoEnabled\(mercadoPagoReady\)/);
  assert.match(checkout, /runtimeMercadoPagoEnabled \? \(/);
  assert.match(checkout, /runtimeMercadoPagoEnabled && paymentMode === "MERCADOPAGO"/);
  assert.match(checkout, /setPaymentMode\("BANK_TRANSFER"\)/);
});
