import type { Product } from "@/types/domain";

const materialPhotos: Record<string, string> = {
  drywallBoard: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1100&q=82",
  metalProfile: "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1100&q=82",
  ceilingPvc: "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=1100&q=82",
  screwsFasteners: "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?auto=format&fit=crop&w=1100&q=82",
  jointCompound: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1100&q=82",
  insulation: "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1100&q=82",
  cementBoard: "https://images.unsplash.com/photo-1590080875515-8a3a8dc5735e?auto=format&fit=crop&w=1100&q=82",
  osbWood: "https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=1100&q=82",
  cement: "https://images.unsplash.com/photo-1517089596392-fb9a9033e05d?auto=format&fit=crop&w=1100&q=82",
  electric: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1100&q=82",
  plumbing: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1100&q=82"
};

const productPhotos: Record<string, string> = {
  "placa-durlock-12-5-mm": materialPhotos.drywallBoard,
  "cemento-portland-50-kg": materialPhotos.cement,
  "perfil-montante-70-mm": materialPhotos.metalProfile,
  "llave-termica-bipolar-25a": materialPhotos.electric,
  "latex-interior-blanco-20-litros": materialPhotos.jointCompound,
  "cano-ppr-20-mm": materialPhotos.plumbing
};

const skuPhotos: Record<string, string> = {
  "FZ-DRL-125": materialPhotos.drywallBoard,
  "FZ-CEM-50": materialPhotos.cement,
  "FZ-PER-M70": materialPhotos.metalProfile,
  "FZ-ELE-T25": materialPhotos.electric,
  "FZ-PIN-L20": materialPhotos.jointCompound,
  "FZ-PLO-PPR20": materialPhotos.plumbing
};

const fallbackPhoto = materialPhotos.drywallBoard;

function isBlankOrLocalPlaceholder(value: string | null | undefined) {
  if (!value) return true;
  const normalized = value.trim();
  return (
    normalized.length === 0 ||
    normalized === "/placeholder-product.jpg" ||
    normalized.endsWith(".svg") ||
    normalized.startsWith("/products/")
  );
}

function isSupportedProductImage(value: string) {
  if (value.startsWith("/") && !value.startsWith("/products/")) return true;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;

    return (
      url.hostname === "images.unsplash.com" ||
      url.hostname.endsWith(".supabase.co") ||
      url.hostname === "res.cloudinary.com" ||
      url.hostname.endsWith(".mitiendanube.com") ||
      url.hostname.endsWith(".cloudfront.net") ||
      url.hostname.endsWith(".tiendanube.com")
    );
  } catch {
    return false;
  }
}

function textForMatching(product: Pick<Product, "slug" | "sku" | "image_url"> & Partial<Pick<Product, "name" | "brand" | "category" | "subcategory">>) {
  return [
    product.slug,
    product.sku,
    product.name,
    product.brand,
    product.subcategory,
    product.category?.name,
    product.image_url
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function inferredMaterialPhoto(product: Pick<Product, "slug" | "sku" | "image_url"> & Partial<Pick<Product, "name" | "brand" | "category" | "subcategory">>) {
  const text = textForMatching(product);

  if (/(durlock|placa|yeso|drywall|knauf|gypsum)/.test(text)) return materialPhotos.drywallBoard;
  if (/(montante|solera|perfil|omega|canal|parante|steel|galvanizado)/.test(text)) return materialPhotos.metalProfile;
  if (/(pvc|cielorraso|cielo raso|perimetral)/.test(text)) return materialPhotos.ceilingPvc;
  if (/(tornillo|tarugo|fijacion|fijación|mecha|punta|autoperforante)/.test(text)) return materialPhotos.screwsFasteners;
  if (/(masilla|cinta|enduido|junta|tomada|sellador)/.test(text)) return materialPhotos.jointCompound;
  if (/(lana|aislante|aislacion|aislación|membrana|acustica|acústica|termica|térmica|telgopor|poliestireno)/.test(text)) return materialPhotos.insulation;
  if (/(cementicia|aquaboard|superboard|exterior|extra resist|resist)/.test(text)) return materialPhotos.cementBoard;
  if (/(osb|fenolico|fenólico|madera|placa estructural)/.test(text)) return materialPhotos.osbWood;
  if (/(cemento|arena|cal|plasticor|mortero|adhesivo)/.test(text)) return materialPhotos.cement;
  if (/(cable|termica|térmica|disyuntor|electric|ficha|caja)/.test(text)) return materialPhotos.electric;
  if (/(cano|caño|ppr|plomeria|plomería|agua|desague|desagüe|tubo)/.test(text)) return materialPhotos.plumbing;

  return productPhotos[product.slug] ?? skuPhotos[product.sku] ?? fallbackPhoto;
}

export function resolveProductImageUrl(product: Pick<Product, "slug" | "sku" | "image_url"> & Partial<Pick<Product, "name" | "brand" | "category" | "subcategory">>) {
  const configuredImage = typeof product.image_url === "string" ? product.image_url.trim() : "";

  if (!isBlankOrLocalPlaceholder(configuredImage) && isSupportedProductImage(configuredImage)) {
    return configuredImage;
  }

  return inferredMaterialPhoto(product);
}
