import type { Category, Product } from "@/types/domain";
import { resolveProductImageUrl } from "@/lib/products/images";

export const fallbackCategories: Category[] = [
  {
    id: "cat-construccion-seca",
    name: "Construccion en seco",
    slug: "construccion-en-seco",
    description: "Placas, perfiles, masillas, fijaciones y accesorios para sistemas livianos.",
    image_url: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1200&q=80",
    active: true,
    sort_order: 1
  },
  {
    id: "cat-materiales",
    name: "Materiales",
    slug: "materiales",
    description: "Cemento, cal, arena, ladrillos y productos base para obra.",
    image_url: "https://images.unsplash.com/photo-1517089596392-fb9a9033e05d?auto=format&fit=crop&w=1200&q=80",
    active: true,
    sort_order: 2
  },
  {
    id: "cat-electricidad",
    name: "Electricidad",
    slug: "electricidad",
    description: "Cables, cajas, termicas, disyuntores y canalizacion.",
    image_url: "https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=1200&q=80",
    active: true,
    sort_order: 3
  },
  {
    id: "cat-plomeria",
    name: "Plomeria",
    slug: "plomeria",
    description: "Canos, conexiones, selladores y accesorios sanitarios.",
    image_url: "https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=1200&q=80",
    active: true,
    sort_order: 4
  },
  {
    id: "cat-pintura",
    name: "Pintura",
    slug: "pintura",
    description: "Pinturas, enduidos, rodillos, pinceles y terminaciones.",
    image_url: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=1200&q=80",
    active: true,
    sort_order: 5
  },
  {
    id: "cat-herramientas",
    name: "Herramientas",
    slug: "herramientas",
    description: "Herramientas manuales y electricas para obra y mantenimiento.",
    image_url: "https://images.unsplash.com/photo-1581147036324-c1c89c2c8b5c?auto=format&fit=crop&w=1200&q=80",
    active: true,
    sort_order: 6
  }
];

const fallbackProductRows: Array<Omit<Product, "category">> = [
  {
    id: "prod-placa-durlock-12-5",
    slug: "placa-durlock-12-5-mm",
    sku: "FZ-DRL-125",
    name: "Placa de yeso 12.5 mm",
    description: "Placa estandar para cielorrasos, revestimientos y tabiques interiores.",
    category_id: "cat-construccion-seca",
    subcategory: "Placas",
    brand: "Durlock",
    price: 12900,
    compare_price: 14800,
    stock: 82,
    stock_minimum: 12,
    unit: "unidad",
    image_url: "/products/placa-yeso.svg",
    gallery: [],
    specifications: { espesor: "12.5 mm", uso: "Interior", medida: "1.20 x 2.40 m" },
    featured: true,
    on_sale: true,
    active: true
  },
  {
    id: "prod-cemento-50kg",
    slug: "cemento-portland-50-kg",
    sku: "FZ-CEM-50",
    name: "Cemento Portland 50 kg",
    description: "Cemento de uso general para hormigones, carpetas y mezclas de obra.",
    category_id: "cat-materiales",
    subcategory: "Cemento",
    brand: "Loma Negra",
    price: 9800,
    compare_price: null,
    stock: 125,
    stock_minimum: 20,
    unit: "bolsa",
    image_url: "/products/cemento-50kg.svg",
    gallery: [],
    specifications: { peso: "50 kg", tipo: "Portland", rendimiento: "Segun mezcla" },
    featured: true,
    on_sale: false,
    active: true
  },
  {
    id: "prod-perfil-montante-70",
    slug: "perfil-montante-70-mm",
    sku: "FZ-PER-M70",
    name: "Perfil montante 70 mm",
    description: "Perfil galvanizado para estructura de tabiques en construccion en seco.",
    category_id: "cat-construccion-seca",
    subcategory: "Perfiles",
    brand: "Barbieri",
    price: 4150,
    compare_price: 4900,
    stock: 210,
    stock_minimum: 30,
    unit: "tira",
    image_url: "/products/perfil-montante.svg",
    gallery: [],
    specifications: { largo: "2.60 m", material: "Acero galvanizado", ancho: "70 mm" },
    featured: true,
    on_sale: true,
    active: true
  },
  {
    id: "prod-termica-2x25",
    slug: "llave-termica-bipolar-25a",
    sku: "FZ-ELE-T25",
    name: "Llave termica bipolar 25A",
    description: "Proteccion termomagnetica para instalaciones electricas domiciliarias.",
    category_id: "cat-electricidad",
    subcategory: "Proteccion",
    brand: "Sica",
    price: 8900,
    compare_price: null,
    stock: 34,
    stock_minimum: 8,
    unit: "unidad",
    image_url: "/products/termica-25a.svg",
    gallery: [],
    specifications: { amperaje: "25A", polos: 2, curva: "C" },
    featured: false,
    on_sale: false,
    active: true
  },
  {
    id: "prod-latex-interior-20",
    slug: "latex-interior-blanco-20-litros",
    sku: "FZ-PIN-L20",
    name: "Latex interior blanco 20 L",
    description: "Pintura latex para interiores con buena cobertura y terminacion mate.",
    category_id: "cat-pintura",
    subcategory: "Interior",
    brand: "Alba",
    price: 35900,
    compare_price: 40200,
    stock: 18,
    stock_minimum: 6,
    unit: "balde",
    image_url: "/products/latex-20l.svg",
    gallery: [],
    specifications: { contenido: "20 L", terminacion: "Mate", color: "Blanco" },
    featured: true,
    on_sale: true,
    active: true
  },
  {
    id: "prod-cano-ppr-20",
    slug: "cano-ppr-20-mm",
    sku: "FZ-PLO-PPR20",
    name: "Cano PPR 20 mm",
    description: "Cano para agua fria/caliente en instalaciones sanitarias.",
    category_id: "cat-plomeria",
    subcategory: "Canos",
    brand: "IPS",
    price: 2350,
    compare_price: null,
    stock: 96,
    stock_minimum: 20,
    unit: "tira",
    image_url: "/products/cano-ppr.svg",
    gallery: [],
    specifications: { diametro: "20 mm", uso: "Agua", largo: "4 m" },
    featured: false,
    on_sale: false,
    active: true
  }
];

export const fallbackProducts: Product[] = fallbackProductRows.map((product) => ({
  ...product,
  image_url: resolveProductImageUrl(product),
  category: fallbackCategories.find((category) => category.id === product.category_id) ?? null
}));
