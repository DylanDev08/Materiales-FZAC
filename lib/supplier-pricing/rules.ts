export const YESERA_SUPPLIER_CODE = "LA-YESERA-ROSARINA";
export const UNIVERSO_SUPPLIER_CODE = "UNIVERSO-PINTURAS-SRL";

export type SupplierAuditStatus =
  | "OK"
  | "PRICE_TOO_HIGH"
  | "PRICE_TOO_LOW"
  | "MISSING_SOURCE_PRICE"
  | "MISSING_SOURCE_URL"
  | "MISSING_SUPPLIER"
  | "MANUAL_REVIEW";

export type SupplierPricingRule = {
  marginPercent: number | null;
  thresholdAmount: number | null;
  marginAboveThresholdPercent: number | null;
  roundToWholePeso: boolean;
};

function finiteNonNegative(value: number | null | undefined) {
  return value !== null && value !== undefined && Number.isFinite(value) && value >= 0;
}

function configuredRuleMargin(originalPrice: number, rule: SupplierPricingRule | null | undefined) {
  if (!rule || !finiteNonNegative(rule.marginPercent)) return null;
  if (
    finiteNonNegative(rule.thresholdAmount) &&
    Number(rule.thresholdAmount) > 0 &&
    finiteNonNegative(rule.marginAboveThresholdPercent) &&
    originalPrice > Number(rule.thresholdAmount)
  ) {
    return Number(rule.marginAboveThresholdPercent);
  }
  return Number(rule.marginPercent);
}

export function expectedSupplierMargin(
  supplierCode: string | null | undefined,
  originalPrice: number | null,
  rule?: SupplierPricingRule | null
) {
  if (originalPrice === null || !Number.isFinite(originalPrice) || originalPrice <= 0) return null;

  const configured = configuredRuleMargin(originalPrice, rule);
  if (configured !== null) return configured;

  if (supplierCode === YESERA_SUPPLIER_CODE) return originalPrice > 60_000 ? 10 : 20;
  if (supplierCode === UNIVERSO_SUPPLIER_CODE) return 0;
  return null;
}

export function expectedSupplierPrice(
  supplierCode: string | null | undefined,
  originalPrice: number | null,
  rule?: SupplierPricingRule | null
) {
  const margin = expectedSupplierMargin(supplierCode, originalPrice, rule);
  if (margin === null || originalPrice === null) return null;
  const raw = originalPrice * (1 + margin / 100);
  const roundToWholePeso = rule?.roundToWholePeso ?? supplierCode === YESERA_SUPPLIER_CODE;
  return roundToWholePeso ? Math.round(raw) : Number(raw.toFixed(2));
}

export function supplierAuditStatus(input: {
  supplierName: string | null;
  originalPrice: number | null;
  sourceUrl: string | null;
  currentPrice: number;
  currentMargin: number | null;
  expectedPrice: number | null;
  expectedMargin: number | null;
}): SupplierAuditStatus {
  if (!input.supplierName) return "MISSING_SUPPLIER";
  if (input.originalPrice === null || !Number.isFinite(input.originalPrice) || input.originalPrice <= 0) {
    return "MISSING_SOURCE_PRICE";
  }
  if (!input.sourceUrl) return "MISSING_SOURCE_URL";
  if (input.expectedPrice === null || input.expectedMargin === null) return "MANUAL_REVIEW";
  if (input.currentPrice > input.expectedPrice) return "PRICE_TOO_HIGH";
  if (input.currentPrice < input.expectedPrice) return "PRICE_TOO_LOW";
  if (input.currentMargin !== input.expectedMargin) return "MANUAL_REVIEW";
  return "OK";
}
