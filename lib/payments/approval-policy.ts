import "server-only";

import { getEnv } from "@/lib/utils/env";

export const DEFAULT_PURCHASE_AUTO_APPROVAL_LIMIT = 1_000_000;

export function getPurchaseAutoApprovalLimit() {
  const configured = Number(getEnv("PURCHASE_AUTO_APPROVAL_LIMIT"));
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_PURCHASE_AUTO_APPROVAL_LIMIT;
}

export function requiresAdminPurchaseApproval(total: number) {
  return total > getPurchaseAutoApprovalLimit();
}
