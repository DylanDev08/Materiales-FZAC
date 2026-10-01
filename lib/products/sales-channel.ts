import type { Product } from "@/types/domain";

export function isWhatsAppOnlyProduct(
  product: Pick<Product, "specifications" | "sku" | "slug">
) {
  const channel = String(product.specifications?.sale_channel ?? "").trim().toUpperCase();
  return (
    channel === "WHATSAPP_ONLY" ||
    product.sku === "FZAC-COMBO-CHAU-FILTRACIONES" ||
    product.slug === "combo-chau-filtraciones"
  );
}
