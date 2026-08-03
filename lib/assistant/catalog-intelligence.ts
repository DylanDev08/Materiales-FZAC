import "server-only";

import { getCategories, getProducts } from "@/lib/db/catalog";
import type { Category, Product } from "@/types/domain";

type CatalogSnapshot = {
  products: Product[];
  categories: Category[];
};

export type AssistantCatalogMatch = {
  product: Product;
  score: number;
  reasons: string[];
};

export type AssistantCatalogResult = {
  mode: "overview" | "products" | "not_found";
  matches: AssistantCatalogMatch[];
  categories: Array<{ name: string; slug: string; productCount: number }>;
  equivalentRequest: boolean;
};

const CACHE_TTL_MS = 20_000;
const CATALOG_LIMIT = 500;
let snapshotCache: { expiresAt: number; value: CatalogSnapshot } | null = null;

const STOP_WORDS = new Set([
  "a", "al", "algo", "con", "de", "del", "el", "en", "es", "esta", "este", "hay", "la", "las", "lo",
  "los", "me", "para", "por", "que", "quiero", "un", "una", "ver", "mostrar", "mostrame", "necesito", "busco",
  "buscar", "producto", "productos", "material", "materiales", "catalogo", "precio", "stock", "fzac"
]);

const SYNONYMS: Record<string, string[]> = {
  durlock: ["placa", "yeso", "construccion", "seco"],
  drywall: ["placa", "yeso", "construccion", "seco"],
  latex: ["pintura", "interior"],
  portland: ["cemento"],
  termica: ["termomagnetica", "electricidad"],
  cano: ["tubo", "plomeria"],
  ppr: ["cano", "tubo", "plomeria"],
  revoque: ["cemento", "cal", "arena"],
  contrapiso: ["cemento", "arena", "piedra"],
  cielorraso: ["placa", "perfil", "construccion", "seco"],
  impermeabilizar: ["membrana", "impermeabilizante"],
  tornillo: ["fijacion", "ferreteria"]
};

const EQUIVALENT_TERMS = ["equivalente", "alternativa", "parecido", "similar", "reemplazo", "reemplazar"];
const OVERVIEW_TERMS = ["que venden", "que tienen", "catalogo", "catalogo completo", "todo el catalogo", "rubros", "categorias", "todos los productos", "productos disponibles"];

function normalize(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  const base = normalize(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const expanded = base.flatMap((token) => [token, ...(SYNONYMS[token] ?? [])]);
  return Array.from(new Set(expanded));
}

function specificationText(product: Product) {
  return Object.entries(product.specifications ?? {})
    .map(([key, value]) => `${key} ${String(value)}`)
    .join(" ");
}

function comparableSpecifications(product: Product) {
  const result = new Map<string, string>();
  for (const [rawKey, rawValue] of Object.entries(product.specifications ?? {})) {
    if (!["string", "number", "boolean"].includes(typeof rawValue)) continue;
    const key = normalize(rawKey);
    const value = normalize(rawValue);
    if (key && value) result.set(key, value);
  }
  return result;
}

function categoryCounts(snapshot: CatalogSnapshot) {
  return snapshot.categories
    .map((category) => ({
      name: category.name,
      slug: category.slug,
      productCount: snapshot.products.filter((product) => product.category_id === category.id).length
    }))
    .filter((category) => category.productCount > 0)
    .sort((left, right) => right.productCount - left.productCount || left.name.localeCompare(right.name, "es"));
}

async function loadSnapshot() {
  const now = Date.now();
  if (snapshotCache && snapshotCache.expiresAt > now) return snapshotCache.value;
  const [products, categories] = await Promise.all([
    getProducts({ limit: CATALOG_LIMIT, order: "name_asc" }),
    getCategories()
  ]);
  const value = { products, categories };
  snapshotCache = { expiresAt: now + CACHE_TTL_MS, value };
  return value;
}

export function invalidateAssistantCatalogCache() {
  snapshotCache = null;
}

function scoreProduct(product: Product, query: string, queryTokens: string[]) {
  const normalizedQuery = normalize(query);
  const fields = {
    name: normalize(product.name),
    sku: normalize(product.sku),
    brand: normalize(product.brand),
    category: normalize(product.category?.name),
    subcategory: normalize(product.subcategory),
    description: normalize(product.description),
    specifications: normalize(specificationText(product))
  };
  let score = 0;
  const reasons = new Set<string>();

  if (normalizedQuery && fields.name === normalizedQuery) {
    score += 40;
    reasons.add("nombre exacto");
  } else if (normalizedQuery.length > 2 && fields.name.includes(normalizedQuery)) {
    score += 20;
    reasons.add("nombre");
  }
  if (normalizedQuery && fields.sku === normalizedQuery) {
    score += 45;
    reasons.add("SKU exacto");
  }

  for (const token of queryTokens) {
    if (fields.name.split(" ").includes(token)) {
      score += 7;
      reasons.add("nombre");
    } else if (fields.name.includes(token)) {
      score += 4;
      reasons.add("nombre");
    }
    if (fields.sku.includes(token)) {
      score += 9;
      reasons.add("SKU");
    }
    if (fields.brand.includes(token)) {
      score += 5;
      reasons.add("marca");
    }
    if (fields.category.includes(token)) {
      score += 4;
      reasons.add("categoría");
    }
    if (fields.subcategory.includes(token)) {
      score += 4;
      reasons.add("subcategoría");
    }
    if (fields.specifications.includes(token)) {
      score += 3;
      reasons.add("ficha técnica");
    }
    if (fields.description.includes(token)) {
      score += 2;
      reasons.add("descripción");
    }
  }

  if (product.stock > 0) score += 1;
  if (product.featured) score += 0.5;
  return { score, reasons: Array.from(reasons).slice(0, 3) };
}

function equivalentMatches(anchor: Product, products: Product[]) {
  const anchorSpecs = comparableSpecifications(anchor);
  const criticalSpecs = ["medida", "espesor", "diametro", "largo", "ancho", "capacidad", "peso", "material", "tipo"];
  return products
    .filter((product) => product.id !== anchor.id && product.active)
    .map((product) => {
      let score = 0;
      const reasons: string[] = [];
      if (product.category_id === anchor.category_id) {
        score += 8;
        reasons.push("mismo rubro");
      }
      if (normalize(product.subcategory) === normalize(anchor.subcategory)) {
        score += 7;
        reasons.push("misma subcategoría");
      }
      if (normalize(product.unit) === normalize(anchor.unit)) {
        score += 5;
        reasons.push("misma unidad de venta");
      }
      const candidateSpecs = comparableSpecifications(product);
      let matchingSpecs = 0;
      let conflictingSpecs = 0;
      for (const [key, value] of anchorSpecs) {
        const candidateValue = candidateSpecs.get(key);
        if (!candidateValue) continue;
        if (candidateValue === value) matchingSpecs += 1;
        else if (criticalSpecs.some((term) => key.includes(term))) conflictingSpecs += 1;
      }
      if (matchingSpecs) {
        score += Math.min(matchingSpecs * 3, 9);
        reasons.push("especificaciones compatibles");
      }
      score -= conflictingSpecs * 7;
      return { product, score, reasons: Array.from(new Set(reasons)).slice(0, 3) };
    })
    .filter((match) => match.score >= 12)
    .sort((left, right) => right.score - left.score || left.product.price - right.product.price)
    .slice(0, 3);
}

export async function searchAssistantCatalog(message: string, limit = 4): Promise<AssistantCatalogResult> {
  const snapshot = await loadSnapshot();
  const normalizedMessage = normalize(message);
  const queryTokens = tokens(message);
  const categories = categoryCounts(snapshot);
  const equivalentRequest = EQUIVALENT_TERMS.some((term) => normalizedMessage.includes(term));
  const overviewRequest = OVERVIEW_TERMS.some((term) => normalizedMessage.includes(term)) || queryTokens.length === 0;

  if (overviewRequest && !equivalentRequest) {
    return { mode: "overview", matches: [], categories: categories.slice(0, 8), equivalentRequest };
  }

  const ranked = snapshot.products
    .map((product) => ({ product, ...scoreProduct(product, message, queryTokens) }))
    .filter((match) => match.score >= 4)
    .sort((left, right) => right.score - left.score || Number(right.product.stock > 0) - Number(left.product.stock > 0))
    .slice(0, Math.max(limit, 1));

  if (!ranked.length) return { mode: "not_found", matches: [], categories: categories.slice(0, 8), equivalentRequest };
  if (equivalentRequest) {
    const alternatives = equivalentMatches(ranked[0].product, snapshot.products);
    return {
      mode: "products",
      matches: [ranked[0], ...alternatives].slice(0, limit),
      categories: [],
      equivalentRequest
    };
  }
  return { mode: "products", matches: ranked, categories: [], equivalentRequest };
}
