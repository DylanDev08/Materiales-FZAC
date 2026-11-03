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
