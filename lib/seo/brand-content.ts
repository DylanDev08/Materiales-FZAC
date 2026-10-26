export type BrandSeoContent = {
  slug: string;
  brand: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
};

export const BRAND_SEO: BrandSeoContent[] = [
  {
    slug: "durlock",
    brand: "Durlock",
    title: "Productos Durlock en Rosario",
    description: "Comprá placas, perfiles, masillas, cintas y accesorios Durlock en Rosario. Consultá precios, SKU y disponibilidad en Materiales FZAC.",
    heading: "Productos Durlock en Rosario",
    intro: "Explorá materiales Durlock para construcción en seco: placas, perfiles, masillas, cintas, aislación y complementos disponibles en Materiales FZAC."
  },
  {
    slug: "atenneas",
    brand: "ATENNEAS",
    title: "Productos ATENNEAS en Rosario",
    description: "Consultá productos ATENNEAS para terminaciones y construcción en seco en Rosario con precios y SKU en Materiales FZAC.",
    heading: "Productos ATENNEAS en Rosario",
    intro: "Encontrá soluciones ATENNEAS publicadas en el catálogo FZAC y armá el pedido online para coordinar disponibilidad por WhatsApp."
  },
  {
    slug: "superboard",
    brand: "Superboard",
    title: "Placas y productos Superboard en Rosario",
    description: "Comprá placas y soluciones Superboard para Steel Framing y exteriores en Rosario. Precios, SKU y pedido por WhatsApp en Materiales FZAC.",
    heading: "Productos Superboard en Rosario",
    intro: "Explorá placas y soluciones Superboard para sistemas exteriores y Steel Framing disponibles en Materiales FZAC."
  },
  {
    slug: "fischer",
    brand: "FISCHER",
    title: "Fijaciones Fischer en Rosario",
    description: "Consultá tarugos y fijaciones Fischer en Rosario con precios, SKU y disponibilidad en Materiales FZAC.",
    heading: "Fijaciones Fischer en Rosario",
    intro: "Encontrá fijaciones Fischer para obra y montaje, con identificación por SKU para facilitar compras y reposiciones."
  },
  {
    slug: "realis",
    brand: "REALIS",
    title: "Pinturas Realis en Rosario",
    description: "Consultá pinturas y productos Realis en Rosario con precios online, SKU y pedido por WhatsApp en Materiales FZAC.",
    heading: "Pinturas Realis en Rosario",
    intro: "Explorá las presentaciones Realis disponibles en Materiales FZAC y compará precio, presentación y disponibilidad."
  },
  {
    slug: "fonac",
    brand: "FONAC",
    title: "Aislación FONAC en Rosario",
    description: "Consultá productos FONAC para aislación acústica y construcción en Rosario con precios y SKU en Materiales FZAC.",
    heading: "Productos FONAC en Rosario",
    intro: "Encontrá soluciones FONAC de aislación publicadas en el catálogo y coordiná cantidades y entrega con Materiales FZAC."
  }
];

export function getBrandSeo(slug: string) {
  return BRAND_SEO.find((item) => item.slug === slug) ?? null;
}
