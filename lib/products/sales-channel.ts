import type { Product } from "@/types/domain";

/**
 * Legacy compatibility helper.
 *
 * The storefront now sends every product through the same checkout and the
 * checkout itself finishes on WhatsApp. No product needs to bypass the cart
 * with a separate WhatsApp-only sales channel anymore.
 */
export function isWhatsAppOnlyProduct(
  _product: Pick<Product, "specifications" | "sku" | "slug">
) {
  return false;
}
