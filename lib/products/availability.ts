import type { Product } from "@/types/domain";

export type ProductAvailabilityStatus = "IN_STOCK" | "OUT_OF_STOCK" | "CONSULT";

export function getProductAvailabilityStatus(product: Pick<Product, "stock" | "availability_status">): ProductAvailabilityStatus {
  if (product.availability_status === "IN_STOCK" || product.availability_status === "OUT_OF_STOCK" || product.availability_status === "CONSULT") {
    return product.availability_status;
  }

  return product.stock > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

export function canPurchaseProduct(product: Pick<Product, "stock" | "availability_status">) {
  return getProductAvailabilityStatus(product) === "IN_STOCK" && product.stock > 0;
}

export function productAvailabilityLabel(
  product: Pick<Product, "stock" | "unit" | "availability_status">,
  options: { includeQuantity?: boolean } = {}
) {
  const status = getProductAvailabilityStatus(product);
  if (status === "CONSULT") return "Consultar disponibilidad";
  if (status === "OUT_OF_STOCK") return "Sin stock";
  if (options.includeQuantity === false) return "En stock";
  return `${product.stock} ${product.unit} disponibles`;
}

export function assistantAvailabilityText(product: Pick<Product, "stock" | "unit" | "availability_status">) {
  const status = getProductAvailabilityStatus(product);
  if (status === "CONSULT") return "disponibilidad a consultar";
  if (status === "OUT_OF_STOCK") return "sin stock confirmado";
  return `${product.stock} ${product.unit} disponibles`;
}
