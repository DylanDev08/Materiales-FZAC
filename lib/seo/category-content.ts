export type CategorySeoContent = {
  title: string;
  description: string;
  heading: string;
  paragraphs: string[];
  highlights: string[];
};

const CATEGORY_SEO: Record<string, CategorySeoContent> = {
  "construccion-en-seco": {
    title: "Materiales para Durlock y construcción en seco en Rosario",
    description:
      "Placas Durlock, montantes, soleras, masillas, cintas, tornillos y aislación para construcción en seco en Rosario. Consultá disponibilidad con Materiales FZAC.",
    heading: "Materiales para Durlock y construcción en seco en Rosario",
    paragraphs: [
      "Encontrá placas, perfiles, masillas, cintas, tornillos, aislación y accesorios para paredes, cielorrasos y reformas en seco.",
      "Materiales FZAC trabaja estos sistemas en obra y te permite armar el pedido online para confirmar disponibilidad, cantidades, envío o retiro por WhatsApp."
    ],
    highlights: ["Placas y perfiles", "Masillas y cintas", "Tornillos y fijaciones", "Aislación y complementos"]
  },
  "steel-framing": {
    title: "Materiales para Steel Framing en Rosario",
    description:
      "Perfiles PGC y PGU, placas exteriores, aislación, membranas y accesorios para Steel Framing en Rosario. Pedí materiales con FZAC.",
    heading: "Materiales para Steel Framing en Rosario",
    paragraphs: [
      "Comprá perfiles estructurales, placas exteriores, barreras, aislantes y complementos para sistemas de Steel Framing.",
      "Podés revisar precios, SKU y presentaciones en la web y continuar el pedido con el equipo de FZAC por WhatsApp."
    ],
    highlights: ["Perfiles PGC y PGU", "Placas exteriores", "Barreras y aislación", "Accesorios de montaje"]
  },
  "ferreteria": {
    title: "Ferretería para obra en Rosario",
    description:
      "Tornillos, tarugos, fijaciones y accesorios de ferretería para obra en Rosario. Precios y disponibilidad en Materiales FZAC.",
    heading: "Ferretería y fijaciones para obra en Rosario",
    paragraphs: [
      "Encontrá tornillos, tarugos y fijaciones para construcción en seco, Steel Framing y trabajos generales de obra.",
      "Cada producto muestra SKU, precio y presentación para que puedas identificar exactamente el material al pedirlo."
    ],
    highlights: ["Tornillos", "Tarugos", "Fijaciones", "Accesorios de obra"]
  },
  "pintura-impermeabilizacion": {
    title: "Pinturas e impermeabilizantes en Rosario",
    description:
      "Membranas líquidas, selladores, látex e impermeabilizantes para techos y obra en Rosario. Consultá precios en Materiales FZAC.",
    heading: "Pinturas e impermeabilización para techos y obra en Rosario",
    paragraphs: [
      "Encontrá membranas líquidas, látex, selladores y productos para proteger techos, muros y superficies expuestas a humedad.",
      "Podés armar el pedido desde la tienda y consultar por WhatsApp qué producto conviene según la superficie o el trabajo."
    ],
    highlights: ["Membranas líquidas", "Látex", "Selladores", "Impermeabilización"]
  },
  "materiales-de-obra": {
    title: "Materiales de construcción en Rosario",
    description:
      "Materiales de obra y construcción en Rosario con precios online, SKU y pedido por WhatsApp. Comprá en Materiales FZAC.",
    heading: "Materiales de construcción para obra en Rosario",
    paragraphs: [
      "Consultá materiales básicos para obra con precio publicado, presentación y código SKU.",
      "La tienda permite preparar el pedido y coordinar disponibilidad, retiro, envío y pago directamente con Materiales FZAC."
    ],
    highlights: ["Materiales básicos", "Precios online", "SKU por producto", "Retiro o envío"]
  },
  "herramientas": {
    title: "Herramientas para pintura y obra en Rosario",
    description:
      "Rodillos, pinceletas y herramientas para pintura y obra en Rosario. Consultá productos y precios en Materiales FZAC.",
    heading: "Herramientas para pintura y obra en Rosario",
    paragraphs: [
      "Encontrá herramientas de aplicación y trabajo para complementar tus materiales de pintura, impermeabilización y obra.",
      "Cada ficha muestra el código SKU y el precio para facilitar pedidos y reposiciones."
    ],
    highlights: ["Rodillos", "Pinceletas", "Aplicación", "Herramientas de obra"]
  }
};

export function getCategorySeoContent(slug: string, fallbackName: string, fallbackDescription?: string | null): CategorySeoContent {
  return CATEGORY_SEO[slug] ?? {
    title: `${fallbackName} en Rosario`,
    description:
      fallbackDescription?.trim() ||
      `Comprá ${fallbackName.toLowerCase()} en Rosario con Materiales FZAC. Consultá precios, disponibilidad y pedido por WhatsApp.`,
    heading: `${fallbackName} en Rosario`,
    paragraphs: [
      fallbackDescription?.trim() || `Explorá productos de ${fallbackName.toLowerCase()} disponibles en Materiales FZAC.`,
      "Consultá precio, SKU y presentación, armá tu pedido online y continuá la coordinación por WhatsApp."
    ],
    highlights: ["Precios online", "SKU visible", "Pedido por WhatsApp", "Retiro o envío"]
  };
}
