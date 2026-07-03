import type { Product } from "@/types/domain";

const productPhotos: Record<string, string> = {
  "placa-durlock-12-5-mm": "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1000&q=80",
  "cemento-portland-50-kg": "https://images.unsplash.com/photo-1517089596392-fb9a9033e05d?auto=format&fit=crop&w=1000&q=80",
  "perfil-montante-70-mm": "https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=1000&q=80",
  "llave-termica-bipolar-25a": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1000&q=80",
  "latex-interior-blanco-20-litros": "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1000&q=80",
  "cano-ppr-20-mm": "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1000&q=80"
};

const skuPhotos: Record<string, string> = {
  "FZ-DRL-125": productPhotos["placa-durlock-12-5-mm"],
  "FZ-CEM-50": productPhotos["cemento-portland-50-kg"],
  "FZ-PER-M70": productPhotos["perfil-montante-70-mm"],
  "FZ-ELE-T25": productPhotos["llave-termica-bipolar-25a"],
  "FZ-PIN-L20": productPhotos["latex-interior-blanco-20-litros"],
  "FZ-PLO-PPR20": productPhotos["cano-ppr-20-mm"]
};

const fallbackPhoto = productPhotos["placa-durlock-12-5-mm"];

function isLegacyProductImage(value: string | null | undefined) {
  return !value || value.endsWith(".svg") || value.includes("/products/");
}

function isSupportedProductImage(value: string) {
  if (value.startsWith("/")) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      (url.hostname === "images.unsplash.com" ||
        url.hostname.endsWith(".supabase.co") ||
        url.hostname === "res.cloudinary.com")
    );
  } catch {
    return false;
  }
}

export function resolveProductImageUrl(product: Pick<Product, "slug" | "sku" | "image_url">) {
  if (!isLegacyProductImage(product.image_url) && isSupportedProductImage(product.image_url)) return product.image_url;
  return productPhotos[product.slug] ?? skuPhotos[product.sku] ?? fallbackPhoto;
}
