import type { Product } from "@/types/domain";

/**
 * Legacy compatibility helper.
 *
 * Every product now uses the same cart/checkout flow and the checkout finishes
 * with WhatsApp coordination. No product bypasses the cart anymore.
 */
export function isWhatsAppOnlyProduct(
  product: Pick<Product, "specifications" | "sku" | "slug">
) {
  void product;
  return false;
}
