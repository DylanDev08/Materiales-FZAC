import type { Product, ProductPromotionType } from "@/types/domain";

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function promotionLabel(product: Pick<Product, "promotion_type" | "promotion_discount_percent">) {
  if (product.promotion_type === "TWO_FOR_ONE") return "2x1";
  if (product.promotion_type === "SECOND_UNIT_PERCENT") {
    const percent = Number(product.promotion_discount_percent ?? 0);
    return percent > 0 ? `2da unidad -${percent}%` : null;
  }
  return null;
}

export function productLinePricing(
  product: Pick<Product, "price" | "promotion_type" | "promotion_discount_percent">,
  quantity: number
) {
  const qty = Math.max(0, Math.trunc(Number(quantity) || 0));
  const unitPrice = Number(product.price) || 0;
  const regularTotal = roundMoney(unitPrice * qty);
  const type: ProductPromotionType = product.promotion_type ?? "NONE";

  let total = regularTotal;
  if (type === "TWO_FOR_ONE" && qty > 0) {
    total = roundMoney(unitPrice * Math.ceil(qty / 2));
  } else if (type === "SECOND_UNIT_PERCENT" && qty > 0) {
    const percent = Math.min(100, Math.max(0, Number(product.promotion_discount_percent ?? 0)));
    const discountedUnits = Math.floor(qty / 2);
    total = roundMoney(regularTotal - unitPrice * discountedUnits * (percent / 100));
  }

  return {
    quantity: qty,
    unitPrice,
    regularTotal,
    total,
    savings: roundMoney(Math.max(0, regularTotal - total)),
    hasPromotion: total < regularTotal
  };
}
