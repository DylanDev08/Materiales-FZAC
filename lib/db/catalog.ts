import "server-only";

import { cache } from "react";
import { fallbackCategories, fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveProductImageUrl } from "@/lib/products/images";
import { sanitizeSearchTerm } from "@/lib/validations/security";
import type { Category, Product, ProductAvailabilityStatus } from "@/types/domain";

export type ProductFilters = {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  availability?: ProductAvailabilityStatus;
  onSale?: boolean;
  featured?: boolean;
  order?: "price_asc" | "price_desc" | "stock_desc" | "offers" | "newest" | "name_asc";
  limit?: number;
};

export const PUBLIC_CATEGORY_SLUGS = ["construccion-en-seco", "steel-framing", "ferreteria"] as const;
const PUBLIC_SUPPLIER_CODE = "LA-YESERA-ROSARINA";
const PUBLIC_PRODUCT_SELECT = "id,slug,sku,name,description,category_id,subcategory,brand,price,compare_price,stock,stock_minimum,availability_status,unit,image_url,gallery,specifications,featured,on_sale,active,category:categories(id,name,slug,description,image_url,parent_id,active,sort_order)";
const SEARCH_WORD_ALIASES: Record<string, string> = {
  placas: "placa",
  montantes: "montante",
  soleras: "solera",
  perfiles: "perfil",
  masillas: "masilla",
  cintas: "cinta",
  tornillos: "tornillo"
};

function catalogSearchTerms(input: string) {
  const search = sanitizeSearchTerm(input).toLowerCase();
  if (!search) return [];
  if (search.includes("montante") && search.includes("solera")) return ["montante", "solera"];
  if (search.includes("masilla") && search.includes("cinta")) return ["masilla", "cinta"];
  if (search === "pared" || search === "pared durlock") return ["durlock"];
  const aliased = search
    .split(/\s+/)
    .map((word) => SEARCH_WORD_ALIASES[word] ?? word)
    .join(" ");
  return aliased === search ? [search] : [search, aliased];
}

const getPublicSupplierId = cache(async () => {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("suppliers")
    .select("id")
    .eq("code", PUBLIC_SUPPLIER_CODE)
    .eq("active", true)
    .maybeSingle();
  return error || !data ? null : String(data.id);
});

export type CatalogFacets = {
  brands: string[];
};

function normalizeCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ""),
    image_url: (row.image_url ?? row.image ?? null) as string | null,
    parent_id: (row.parent_id ?? row.parentId ?? null) as string | null,
    active: Boolean(row.active ?? true),
    sort_order: Number(row.sort_order ?? row.sortOrder ?? 0)
  };
}

function normalizeAvailabilityStatus(row: Record<string, unknown>): ProductAvailabilityStatus {
  const status = String(row.availability_status ?? "").toUpperCase();
  if (status === "CONSULT" || status === "OUT_OF_STOCK" || status === "IN_STOCK") return status;
  return Number(row.stock ?? 0) > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

function normalizeProduct(row: Record<string, unknown>): Product {
  const categoryRow = (row.category ?? row.categories ?? null) as Record<string, unknown> | null;
  const product = {
    id: String(row.id),
    slug: String(row.slug),
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description ?? ""),
    category_id: String(row.category_id ?? row.categoryId ?? ""),
    category: categoryRow ? normalizeCategory(categoryRow) : null,
    subcategory: String(row.subcategory ?? "General"),
    brand: String(row.brand ?? "FZAC"),
    price: Number(row.price ?? 0),
    compare_price: row.compare_price || row.comparePrice ? Number(row.compare_price ?? row.comparePrice) : null,
    stock: Number(row.stock ?? 0),
    stock_minimum: Number(row.stock_minimum ?? row.stockMinimum ?? 0),
    availability_status: normalizeAvailabilityStatus(row),
    unit: String(row.unit ?? "unidad"),
    image_url: String(row.image_url ?? row.image ?? "/placeholder-product.jpg"),
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
    specifications: ((row.specifications ?? {}) as Product["specifications"]) || {},
    featured: Boolean(row.featured),
    on_sale: Boolean(row.on_sale ?? row.onSale),
    active: Boolean(row.active ?? true)
  };

  return { ...product, image_url: resolveProductImageUrl(product) };
}

function applyFallbackFilters(products: Product[], filters: ProductFilters) {
  let result = products.filter((product) => product.active && PUBLIC_CATEGORY_SLUGS.includes(product.category?.slug as typeof PUBLIC_CATEGORY_SLUGS[number]));

  if (filters.search) {
    const terms = catalogSearchTerms(filters.search);
    result = result.filter((product) =>
      terms.some((term) => [
        product.name,
        product.sku,
        product.brand,
        product.description,
        product.category?.name,
        product.category?.slug,
        product.subcategory,
        ...Object.entries(product.specifications).flatMap(([key, value]) => [key, String(value)])
      ].join(" ").toLowerCase().includes(term))
    );
  }

  if (filters.category) {
    result = result.filter((product) => {
      return product.category?.slug === filters.category || product.category_id === filters.category;
    });
  }

  if (filters.brand) {
    const brand = sanitizeSearchTerm(filters.brand).toLowerCase();
    result = result.filter((product) => product.brand.toLowerCase() === brand);
  }

  if (filters.minPrice) result = result.filter((product) => product.price >= Number(filters.minPrice));
  if (filters.maxPrice) result = result.filter((product) => product.price <= Number(filters.maxPrice));
  if (filters.inStock) result = result.filter((product) => product.availability_status === "IN_STOCK" && product.stock > 0);
  if (filters.availability) result = result.filter((product) => product.availability_status === filters.availability);
  if (filters.onSale) result = result.filter((product) => product.on_sale);
  if (filters.featured) result = result.filter((product) => product.featured);

  switch (filters.order) {
    case "price_asc":
      result = result.sort((a, b) => a.price - b.price);
      break;
    case "price_desc":
      result = result.sort((a, b) => b.price - a.price);
      break;
    case "name_asc":
      result = result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "stock_desc":
      result = result.sort((a, b) => b.stock - a.stock);
      break;
    case "offers":
      result = result.sort((a, b) => Number(b.on_sale) - Number(a.on_sale) || b.stock - a.stock);
      break;
    default:
      result = result.sort((a, b) => Number(b.featured) - Number(a.featured));
  }

  return result.slice(0, filters.limit ?? 48);
}

export const getCategories = cache(async function getCategories() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return fallbackCategories.filter((category) => PUBLIC_CATEGORY_SLUGS.includes(category.slug as typeof PUBLIC_CATEGORY_SLUGS[number]));

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .in("slug", [...PUBLIC_CATEGORY_SLUGS])
    .order("sort_order", { ascending: true });

  if (error) return [];
  return (data ?? []).map(normalizeCategory);
});

export async function getCatalogFacets(): Promise<CatalogFacets> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    const publicProducts = applyFallbackFilters(fallbackProducts, { limit: 500 });
    return {
      brands: Array.from(new Set(publicProducts.map((product) => product.brand).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, "es")
      )
    };
  }

  const supplierId = await getPublicSupplierId();
  if (!supplierId) return { brands: [] };

  const categories = await getCategories();
  const { data, error } = await supabase
    .from("products")
    .select("brand")
    .eq("active", true)
    .eq("supplier_id", supplierId)
    .in("category_id", categories.map((category) => category.id))
    .limit(1000);
  if (error) return { brands: [] };

  return {
    brands: Array.from(new Set((data ?? []).map((row) => String(row.brand ?? "").trim()).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, "es")
    )
  };
}

export async function getProducts(filters: ProductFilters = {}) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return applyFallbackFilters(fallbackProducts, filters);

  const [supplierId, categories] = await Promise.all([getPublicSupplierId(), getCategories()]);
  if (!supplierId || !categories.length) return [];

  let query = supabase
    .from("products")
    .select(PUBLIC_PRODUCT_SELECT)
    .eq("active", true)
    .eq("supplier_id", supplierId)
    .in("category_id", categories.map((category) => category.id))
    .limit(filters.limit ?? 48);

  if (filters.search) {
    const terms = catalogSearchTerms(filters.search).filter((term) => term.length >= 2);
    if (terms.length) {
      const categoryIds = categories
        .filter((category) => terms.some((term) => [category.name, category.slug, category.description].join(" ").toLowerCase().includes(term)))
        .map((category) => category.id);
      const clauses = terms.flatMap((term) => [
        `name.ilike.%${term}%`,
        `sku.ilike.%${term}%`,
        `brand.ilike.%${term}%`,
        `subcategory.ilike.%${term}%`,
        `description.ilike.%${term}%`
      ]);
      if (categoryIds.length) clauses.push(`category_id.in.(${categoryIds.join(",")})`);
      query = query.or(clauses.join(","));
    }
  }

  if (filters.category) {
    const categories = await getCategories();
    const category = categories.find((item) => item.slug === filters.category || item.id === filters.category);
    if (category) query = query.eq("category_id", category.id);
  }

  if (filters.brand) query = query.ilike("brand", sanitizeSearchTerm(filters.brand));
  if (filters.minPrice) query = query.gte("price", filters.minPrice);
  if (filters.maxPrice) query = query.lte("price", filters.maxPrice);
  if (filters.inStock) query = query.eq("availability_status", "IN_STOCK").gt("stock", 0);
  if (filters.availability) query = query.eq("availability_status", filters.availability);
  if (filters.onSale) query = query.eq("on_sale", true);
  if (filters.featured) query = query.eq("featured", true);

  if (filters.order === "price_asc") query = query.order("price", { ascending: true });
  else if (filters.order === "price_desc") query = query.order("price", { ascending: false });
  else if (filters.order === "stock_desc") query = query.order("stock", { ascending: false });
  else if (filters.order === "offers") query = query.order("on_sale", { ascending: false }).order("stock", { ascending: false });
  else if (filters.order === "name_asc") query = query.order("name", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []).map(normalizeProduct);
}

export const getProductBySlug = cache(async function getProductBySlug(slug: string) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return applyFallbackFilters(fallbackProducts, { limit: 500 }).find((product) => product.slug === slug) ?? null;
  }

  const [supplierId, categories] = await Promise.all([getPublicSupplierId(), getCategories()]);
  if (!supplierId || !categories.length) return null;

  const { data, error } = await supabase
    .from("products")
    .select(PUBLIC_PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("active", true)
    .eq("supplier_id", supplierId)
    .in("category_id", categories.map((category) => category.id))
    .maybeSingle();

  if (error || !data) return null;
  return normalizeProduct(data);
});

export async function getRelatedProducts(product: Product) {
  const related = await getProducts({ category: product.category?.slug ?? product.category_id, limit: 8 });
  return related.filter((item) => item.id !== product.id).slice(0, 4);
}

export type ProductSuggestion = {
  type: "product" | "category" | "brand" | "term";
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  sku?: string;
  brand?: string;
  price?: number;
  image_url?: string;
};

const suggestionCache = new Map<
  string,
  { expiresAt: number; value?: ProductSuggestion[]; pending?: Promise<ProductSuggestion[]> }
>();
const SUGGESTION_CACHE_TTL_MS = 30_000;
const SUGGESTION_CACHE_MAX = 100;

function trimSuggestionCache(now: number) {
  for (const [key, entry] of suggestionCache) {
    if (entry.expiresAt <= now && !entry.pending) suggestionCache.delete(key);
  }
  while (suggestionCache.size > SUGGESTION_CACHE_MAX) {
    const oldest = suggestionCache.keys().next().value as string | undefined;
    if (!oldest) break;
    suggestionCache.delete(oldest);
  }
}

async function loadProductSuggestions(search: string): Promise<ProductSuggestion[]> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const databaseResults = Promise.all([getProducts({ search, limit: 6 }), getCategories()]);
  const timeout = new Promise<[Product[], Category[]]>((resolve) => {
    timeoutId = setTimeout(() => resolve([[], []]), 1_200);
  });
  const [products, categories] = await Promise.race([databaseResults, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  const normalized = search.toLowerCase();
  const categorySuggestions = categories
    .filter((category) =>
      [category.name, category.slug, category.description].join(" ").toLowerCase().includes(normalized)
    )
    .slice(0, 3)
    .map((category) => ({
      type: "category" as const,
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description
    }));

  const brandSuggestions = Array.from(new Set(products.map((product) => product.brand).filter(Boolean)))
    .slice(0, 3)
    .map((brand) => ({
      type: "brand" as const,
      id: `brand-${brand}`,
      name: brand,
      slug: brand
    }));

  const termSuggestions = [
    { match: "durlock", name: "Placas, perfiles, masilla y cinta" },
    { match: "steel framing", name: "Perfiles estructurales y placas exteriores" },
    { match: "cielorraso", name: "Placas, PVC y perfilería para cielorrasos" },
    { match: "ferreteria", name: "Tornillos, tarugos y fijaciones" }
  ]
    .filter((term) => term.match.includes(normalized) || term.name.toLowerCase().includes(normalized))
    .slice(0, 2)
    .map((term) => ({
      type: "term" as const,
      id: `term-${term.match}`,
      name: term.name,
      slug: term.match
    }));

  return [
    ...products.slice(0, 6).map((product) => ({
      type: "product" as const,
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brand: product.brand,
      price: product.price,
      image_url: product.image_url
    })),
    ...categorySuggestions,
    ...brandSuggestions,
    ...termSuggestions
  ].slice(0, 10);
}

export async function getProductSuggestions(query: string): Promise<ProductSuggestion[]> {
  const search = sanitizeSearchTerm(query, 50).toLowerCase();
  if (search.length < 2) return [];

  const now = Date.now();
  const cached = suggestionCache.get(search);
  if (cached && cached.expiresAt > now) {
    if (cached.value) return cached.value;
    if (cached.pending) return cached.pending;
  }

  const pending = loadProductSuggestions(search);
  suggestionCache.set(search, { expiresAt: now + SUGGESTION_CACHE_TTL_MS, pending });
  trimSuggestionCache(now);

  try {
    const value = await pending;
    suggestionCache.set(search, { expiresAt: Date.now() + SUGGESTION_CACHE_TTL_MS, value });
    return value;
  } catch (error) {
    suggestionCache.delete(search);
    throw error;
  }
}
