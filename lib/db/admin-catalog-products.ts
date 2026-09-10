import "server-only";

import { fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Product, ProductAvailabilityStatus } from "@/types/domain";

function availabilityStatus(row: Record<string, unknown>): ProductAvailabilityStatus {
  const status = String(row.availability_status ?? "").toUpperCase();
  if (status === "IN_STOCK" || status === "OUT_OF_STOCK" || status === "CONSULT") return status;
  return Number(row.stock ?? 0) > 0 ? "IN_STOCK" : "OUT_OF_STOCK";
}

function normalizeAdminProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id),
    slug: String(row.slug),
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description ?? ""),
    category_id: String(row.category_id ?? ""),
    subcategory: String(row.subcategory ?? "General"),
    brand: String(row.brand ?? "FZAC"),
    price: Number(row.price ?? 0),
    compare_price: row.compare_price ? Number(row.compare_price) : null,
    stock: Number(row.stock ?? 0),
    stock_minimum: Number(row.stock_minimum ?? 0),
    availability_status: availabilityStatus(row),
    unit: String(row.unit ?? "unidad"),
    image_url: String(row.image_url ?? ""),
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
    specifications: (row.specifications as Product["specifications"]) ?? {},
    featured: Boolean(row.featured),
    on_sale: Boolean(row.on_sale),
    active: Boolean(row.active ?? true)
  };
}

export async function getAdminCatalogProducts() {
  const admin = getSupabaseAdminClient();
  if (!admin) return fallbackProducts;

  const { data, error } = await admin
    .from("products")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) return [];
  return (data ?? []).map((row) => normalizeAdminProduct(row as Record<string, unknown>));
}
