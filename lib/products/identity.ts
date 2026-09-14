export function normalizeProductIdentity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/\b(?:metros?|mts?|ml)\b/g, "m")
    .replace(/\s*x\s*/g, "x")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type ProductIdentity = { id?: string; name: string; slug: string; sku: string };

export function duplicateReason(candidate: ProductIdentity, existing: ProductIdentity[]) {
  const normalizedSku = candidate.sku.trim().toLowerCase();
  const normalizedSlug = candidate.slug.trim().toLowerCase();
  const normalizedName = normalizeProductIdentity(candidate.name);
  const match = existing.find((product) => {
    if (candidate.id && product.id === candidate.id) return false;
    return product.sku.trim().toLowerCase() === normalizedSku
      || product.slug.trim().toLowerCase() === normalizedSlug
      || normalizeProductIdentity(product.name) === normalizedName;
  });
  if (!match) return null;
  if (match.sku.trim().toLowerCase() === normalizedSku) return `Ya existe un producto con SKU ${match.sku}.`;
  if (match.slug.trim().toLowerCase() === normalizedSlug) return `Ya existe un producto con slug ${match.slug}.`;
  return `El nombre coincide con “${match.name}”. Revisalo antes de crear otro producto.`;
}
