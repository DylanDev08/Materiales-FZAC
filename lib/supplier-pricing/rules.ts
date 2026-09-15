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

export function expectedSupplierMargin(supplierCode: string | null | undefined, originalPrice: number | null) {
  if (originalPrice === null || !Number.isFinite(originalPrice) || originalPrice <= 0) return null;
  if (supplierCode === YESERA_SUPPLIER_CODE) return originalPrice > 60_000 ? 10 : 20;
  if (supplierCode === UNIVERSO_SUPPLIER_CODE) return 0;
  return null;
}

export function expectedSupplierPrice(supplierCode: string | null | undefined, originalPrice: number | null) {
  const margin = expectedSupplierMargin(supplierCode, originalPrice);
  if (margin === null || originalPrice === null) return null;
  return supplierCode === UNIVERSO_SUPPLIER_CODE
    ? Number(originalPrice.toFixed(2))
    : Math.round(originalPrice * (1 + margin / 100));
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
