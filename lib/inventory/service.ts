import "server-only";

import { buildInventoryForecast, type InventoryForecastProduct, type InventoryPendingDemand, type InventorySaleMovement } from "@/lib/inventory/forecast";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const PAGE_SIZE = 1_000;
const MAX_SALE_MOVEMENTS = 20_000;
const PENDING_STATUSES = ["PENDING_PAYMENT", "PENDING_TRANSFER", "PENDING_ADMIN_APPROVAL", "COORDINATE"];

function boundedEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, Math.round(value))) : fallback;
}

async function getSaleMovements(startedAt: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { rows: [] as InventorySaleMovement[], truncated: false };
  const rows: InventorySaleMovement[] = [];
  let offset = 0;
  while (rows.length < MAX_SALE_MOVEMENTS) {
    const { data, error } = await admin
      .from("inventory_movements")
      .select("product_id,quantity,created_at")
      .eq("type", "SALE")
      .gte("created_at", startedAt)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error("No pudimos leer los movimientos de inventario.");
    const page = (data ?? []) as InventorySaleMovement[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { rows, truncated: false };
    offset += PAGE_SIZE;
  }
  return { rows: rows.slice(0, MAX_SALE_MOVEMENTS), truncated: true };
}

async function getPendingDemand(now: number) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { rows: [] as InventoryPendingDemand[], truncated: false };
  const pendingSince = new Date(now - 30 * 86_400_000).toISOString();
  const { data: orders, error: orderError } = await admin
    .from("orders")
    .select("id")
    .in("status", PENDING_STATUSES)
    .gte("created_at", pendingSince)
    .order("created_at", { ascending: false })
    .limit(3_000);
  if (orderError) throw new Error("No pudimos leer los pedidos pendientes.");
  const orderIds = (orders ?? []).map((order) => String(order.id));
  const rows: InventoryPendingDemand[] = [];
  for (let offset = 0; offset < orderIds.length; offset += 200) {
    const ids = orderIds.slice(offset, offset + 200);
    const { data, error } = await admin.from("order_items").select("product_id,quantity").in("order_id", ids);
    if (error) throw new Error("No pudimos calcular la demanda pendiente.");
    rows.push(...((data ?? []).filter((item) => item.product_id) as InventoryPendingDemand[]));
  }
  return { rows, truncated: orderIds.length >= 3_000 };
}

export async function getInventoryForecast(rangeDays: 30 | 60 | 90) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return buildInventoryForecast({ products: [], sales: [], pendingDemand: [], rangeDays });
  }
  const now = Date.now();
  const startedAt = new Date(now - rangeDays * 86_400_000).toISOString();
  const [productsResult, salesResult, pendingResult] = await Promise.all([
    admin
      .from("products")
      .select("id,name,sku,unit,stock,stock_minimum,price,category:categories(name)")
      .eq("active", true)
      .order("name")
      .limit(2_000),
    getSaleMovements(startedAt),
    getPendingDemand(now)
  ]);
  if (productsResult.error) throw new Error("No pudimos cargar el inventario activo.");
  const productsTruncated = (productsResult.data?.length ?? 0) >= 2_000;

  const products: InventoryForecastProduct[] = (productsResult.data ?? []).map((product) => {
    const categoryValue = product.category as unknown;
    const category = Array.isArray(categoryValue) ? categoryValue[0] : categoryValue;
    return {
      id: String(product.id),
      name: String(product.name),
      sku: String(product.sku),
      unit: String(product.unit ?? "unidad"),
      stock: Number(product.stock ?? 0),
      stock_minimum: Number(product.stock_minimum ?? 0),
      price: Number(product.price ?? 0),
      categoryName: category && typeof category === "object" && "name" in category ? String(category.name) : "Sin categoría"
    };
  });

  return buildInventoryForecast({
    products,
    sales: salesResult.rows,
    pendingDemand: pendingResult.rows,
    rangeDays,
    now,
    leadTimeDays: boundedEnv("INVENTORY_LEAD_TIME_DAYS", 7, 1, 60),
    safetyDays: boundedEnv("INVENTORY_SAFETY_DAYS", 5, 0, 30),
    targetCoverageDays: boundedEnv("INVENTORY_TARGET_COVERAGE_DAYS", 30, 7, 120),
    truncated: productsTruncated || salesResult.truncated || pendingResult.truncated
  });
}

export type InventoryForecastData = Awaited<ReturnType<typeof getInventoryForecast>>;
