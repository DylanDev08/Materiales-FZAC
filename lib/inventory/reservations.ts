import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Product } from "@/types/domain";

export type StockAvailability = {
  productId: string;
  physicalStock: number;
  reservedStock: number;
  availableStock: number;
};

export type StockReservationState = {
  active: boolean;
  expiresAt: string | null;
};

export async function getAvailableStockForProductIds(productIds: string[]) {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  const admin = getSupabaseAdminClient();
  if (!admin || !ids.length) return new Map<string, StockAvailability>();

  const { data, error } = await admin.rpc("get_product_available_stock", {
    p_product_ids: ids
  });

  if (error) return new Map<string, StockAvailability>();

  return new Map<string, StockAvailability>(
    (data ?? []).map((row: Record<string, unknown>): [string, StockAvailability] => {
      const value: StockAvailability = {
        productId: String(row.product_id),
        physicalStock: Number(row.physical_stock ?? 0),
        reservedStock: Number(row.reserved_stock ?? 0),
        availableStock: Number(row.available_stock ?? 0)
      };
      return [value.productId, value];
    })
  );
}

export async function applyAvailableStockToProducts(products: Product[]) {
  if (!products.length) return products;
  const availability = await getAvailableStockForProductIds(products.map((product) => product.id));
  if (!availability.size) return products;

  return products.map((product): Product => {
    const stock = availability.get(product.id);
    if (!stock) return product;
    const available = Math.max(0, stock.availableStock);
    const availabilityStatus: Product["availability_status"] =
      product.availability_status === "CONSULT"
        ? "CONSULT"
        : available > 0
          ? product.availability_status === "OUT_OF_STOCK"
            ? "OUT_OF_STOCK"
            : "IN_STOCK"
          : "OUT_OF_STOCK";

    return {
      ...product,
      stock: available,
      availability_status: availabilityStatus
    };
  });
}

export async function getActiveOrderStockReservation(orderId: string): Promise<StockReservationState> {
  const admin = getSupabaseAdminClient();
  if (!admin) return { active: false, expiresAt: null };

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("stock_reservations")
    .select("expires_at")
    .eq("order_id", orderId)
    .eq("status", "ACTIVE")
    .gt("expires_at", now)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.expires_at) return { active: false, expiresAt: null };
  return { active: true, expiresAt: String(data.expires_at) };
}

export async function reserveOrderStock(orderId: string, ttlMinutes = 30) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("STOCK_RESERVATION_BACKEND_UNAVAILABLE");

  const { data, error } = await admin.rpc("reserve_order_stock", {
    p_order_id: orderId,
    p_ttl_minutes: ttlMinutes
  });

  if (error) {
    const detail = `${error.message ?? ""} ${error.details ?? ""}`;
    if (detail.includes("INSUFFICIENT_AVAILABLE_STOCK")) {
      throw new Error("INSUFFICIENT_AVAILABLE_STOCK");
    }
    throw new Error("STOCK_RESERVATION_FAILED");
  }

  const result = (data ?? {}) as { expires_at?: string };
  return {
    expiresAt: result.expires_at ? String(result.expires_at) : null
  };
}

export async function releaseOrderStockReservation(orderId: string, reason: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("STOCK_RESERVATION_BACKEND_UNAVAILABLE");

  const { error } = await admin.rpc("release_order_stock_reservation", {
    p_order_id: orderId,
    p_reason: reason
  });
  if (error) throw new Error("STOCK_RESERVATION_RELEASE_FAILED");
}
