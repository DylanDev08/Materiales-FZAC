import "server-only";

import { fallbackCategories, fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveProductImageUrl } from "@/lib/products/images";
import { sanitizeSearchTerm } from "@/lib/validations/security";
import type { Category, Product } from "@/types/domain";

export type ProductFilters = {
  search?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  onSale?: boolean;
  featured?: boolean;
  order?: "price_asc" | "price_desc" | "stock_desc" | "offers" | "newest" | "name_asc";
  limit?: number;
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
  let result = products.filter((product) => product.active);

  if (filters.search) {
    const search = sanitizeSearchTerm(filters.search).toLowerCase();
    result = result.filter((product) =>
      [product.name, product.sku, product.brand, product.description].join(" ").toLowerCase().includes(search)
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
  if (filters.inStock) result = result.filter((product) => product.stock > 0);
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

export async function getCategories() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return fallbackCategories;

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return fallbackCategories;
  return data.map(normalizeCategory);
}

export async function getProducts(filters: ProductFilters = {}) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return applyFallbackFilters(fallbackProducts, filters);

  let query = supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("active", true)
    .limit(filters.limit ?? 48);

  if (filters.search) {
    const search = sanitizeSearchTerm(filters.search);
    if (search.length >= 2) {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`);
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
  if (filters.inStock) query = query.gt("stock", 0);
  if (filters.onSale) query = query.eq("on_sale", true);
  if (filters.featured) query = query.eq("featured", true);

  if (filters.order === "price_asc") query = query.order("price", { ascending: true });
  else if (filters.order === "price_desc") query = query.order("price", { ascending: false });
  else if (filters.order === "stock_desc") query = query.order("stock", { ascending: false });
  else if (filters.order === "offers") query = query.order("on_sale", { ascending: false }).order("stock", { ascending: false });
  else if (filters.order === "name_asc") query = query.order("name", { ascending: true });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error || !data?.length) return applyFallbackFilters(fallbackProducts, filters);

  return data.map(normalizeProduct);
}

export async function getProductBySlug(slug: string) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return fallbackProducts.find((product) => product.slug === slug) ?? null;

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();

  if (error || !data) return fallbackProducts.find((product) => product.slug === slug) ?? null;
  return normalizeProduct(data);
}

export async function getRelatedProducts(product: Product) {
  const related = await getProducts({ category: product.category?.slug ?? product.category_id, limit: 8 });
  return related.filter((item) => item.id !== product.id).slice(0, 4);
}

export async function getProductSuggestions(query: string) {
  const search = sanitizeSearchTerm(query, 50);
  if (search.length < 2) return [];

  const [products, categories] = await Promise.all([getProducts({ search, limit: 6 }), getCategories()]);
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
    { match: "cemento", name: "Cemento, cal, arena e hidrofugos" },
    { match: "drywall", name: "Placas, perfiles, masilla y cinta" },
    { match: "pintura", name: "Pinturas, impermeabilizantes y rodillos" },
    { match: "electricidad", name: "Cables, cajas, canos y termicas" }
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
