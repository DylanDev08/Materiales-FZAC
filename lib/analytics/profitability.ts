import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProfitabilityPeriod = "day" | "week" | "month";

export type ProductProfitability = {
  productId: string;
  name: string;
  sku: string;
  unitsSold: number;
  revenue: number;
  estimatedCost: number | null;
  estimatedMargin: number | null;
  estimatedMarginPercent: number | null;
  latestUnitCost: number | null;
  costObservedAt: string | null;
};

export type ProfitabilityOverview = {
  available: boolean;
  period: ProfitabilityPeriod;
  periodStart: string;
  paidOrders: number;
  productRevenue: number;
  coveredRevenue: number;
  coveragePercent: number;
  estimatedCost: number;
  estimatedGrossMargin: number;
  operatingExpenses: number;
  estimatedContribution: number;
  productsWithoutCost: number;
  products: ProductProfitability[];
};

type OrderRow = { id: string; paid_at: string | null; created_at: string | null };
type OrderItemRow = {
  order_id: string;
  product_id: string | null;
  sku: string | null;
  name: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  subtotal: number | string | null;
};
type PurchaseOrderRow = {
  id: string;
  created_at: string | null;
  ordered_at: string | null;
  received_at: string | null;
};
type PurchaseItemRow = {
  purchase_order_id: string;
  product_id: string;
  unit_cost: number | string;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function startFor(period: ProfitabilityPeriod) {
  const now = new Date();
  if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = now.getDay() || 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function empty(period: ProfitabilityPeriod, available = false): ProfitabilityOverview {
  return {
    available,
    period,
    periodStart: startFor(period).toISOString(),
    paidOrders: 0,
    productRevenue: 0,
    coveredRevenue: 0,
    coveragePercent: 0,
    estimatedCost: 0,
    estimatedGrossMargin: 0,
    operatingExpenses: 0,
    estimatedContribution: 0,
    productsWithoutCost: 0,
    products: []
  };
}

export async function getProfitabilityOverview(period: ProfitabilityPeriod): Promise<ProfitabilityOverview> {
  const admin = getSupabaseAdminClient();
  if (!admin) return empty(period);

  const periodStart = startFor(period).toISOString();
  const paidStatuses = ["PAID", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"];
  const [ordersResult, purchaseOrdersResult, expensesResult] = await Promise.all([
    admin
      .from("orders")
      .select("id,paid_at,created_at")
      .in("status", paidStatuses)
      .gte("paid_at", periodStart)
      .order("paid_at", { ascending: false })
      .limit(800),
    admin
      .from("purchase_orders")
      .select("id,created_at,ordered_at,received_at")
      .in("status", ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"])
      .order("created_at", { ascending: false })
      .limit(800),
    admin
      .from("financial_movements")
      .select("amount,category,source")
      .eq("type", "EXPENSE")
      .eq("status", "ACTIVE")
      .gte("occurred_at", periodStart)
      .limit(1000)
  ]);

  if (ordersResult.error || purchaseOrdersResult.error || expensesResult.error) return empty(period);

  const orders = (ordersResult.data ?? []) as OrderRow[];
  const purchaseOrders = (purchaseOrdersResult.data ?? []) as PurchaseOrderRow[];
  const [itemsResult, purchaseItemsResult] = await Promise.all([
    orders.length
      ? admin
          .from("order_items")
          .select("order_id,product_id,sku,name,quantity,unit_price,subtotal")
          .in("order_id", orders.map((order) => order.id))
          .limit(4000)
      : Promise.resolve({ data: [] as OrderItemRow[], error: null }),
    purchaseOrders.length
      ? admin
          .from("purchase_order_items")
          .select("purchase_order_id,product_id,unit_cost")
          .in("purchase_order_id", purchaseOrders.map((order) => order.id))
          .limit(4000)
      : Promise.resolve({ data: [] as PurchaseItemRow[], error: null })
  ]);

  if (itemsResult.error || purchaseItemsResult.error) return empty(period);

  const purchaseDate = new Map(purchaseOrders.map((order) => [
    order.id,
    order.received_at ?? order.ordered_at ?? order.created_at ?? ""
  ]));
  const latestCost = new Map<string, { cost: number; observedAt: string }>();
  for (const item of (purchaseItemsResult.data ?? []) as PurchaseItemRow[]) {
    const observedAt = purchaseDate.get(item.purchase_order_id) ?? "";
    const current = latestCost.get(item.product_id);
    if (!current || Date.parse(observedAt) > Date.parse(current.observedAt)) {
      latestCost.set(item.product_id, { cost: numeric(item.unit_cost), observedAt });
    }
  }

  const byProduct = new Map<string, ProductProfitability>();
  let productRevenue = 0;
  let coveredRevenue = 0;
  let estimatedCost = 0;

  for (const item of (itemsResult.data ?? []) as OrderItemRow[]) {
    const quantity = numeric(item.quantity);
    const revenue = numeric(item.subtotal) || numeric(item.unit_price) * quantity;
    productRevenue += revenue;
    const productId = item.product_id ?? `missing:${item.sku ?? item.name ?? "product"}`;
    const costReference = item.product_id ? latestCost.get(item.product_id) : undefined;
    const row = byProduct.get(productId) ?? {
      productId,
      name: String(item.name ?? "Producto"),
      sku: String(item.sku ?? "-"),
      unitsSold: 0,
      revenue: 0,
      estimatedCost: costReference ? 0 : null,
      estimatedMargin: costReference ? 0 : null,
      estimatedMarginPercent: null,
      latestUnitCost: costReference?.cost ?? null,
      costObservedAt: costReference?.observedAt ?? null
    };
    row.unitsSold += quantity;
    row.revenue += revenue;
    if (costReference) {
      const lineCost = costReference.cost * quantity;
      row.estimatedCost = numeric(row.estimatedCost) + lineCost;
      row.estimatedMargin = row.revenue - numeric(row.estimatedCost);
      coveredRevenue += revenue;
      estimatedCost += lineCost;
    }
    byProduct.set(productId, row);
  }

  const products = Array.from(byProduct.values()).map((row) => ({
    ...row,
    estimatedMarginPercent: row.estimatedMargin === null || row.revenue <= 0
      ? null
      : (row.estimatedMargin / row.revenue) * 100
  })).sort((left, right) => {
    if (left.estimatedMarginPercent === null) return 1;
    if (right.estimatedMarginPercent === null) return -1;
    return left.estimatedMarginPercent - right.estimatedMarginPercent;
  });

  const operatingExpenses = (expensesResult.data ?? []).reduce((sum, movement) => {
    const category = String(movement.category ?? "").toLowerCase();
    const source = String(movement.source ?? "");
    if (source === "PURCHASE_PAYMENT" || category.includes("mercader")) return sum;
    return sum + numeric(movement.amount);
  }, 0);
  const estimatedGrossMargin = coveredRevenue - estimatedCost;

  return {
    available: true,
    period,
    periodStart,
    paidOrders: orders.length,
    productRevenue,
    coveredRevenue,
    coveragePercent: productRevenue > 0 ? (coveredRevenue / productRevenue) * 100 : 0,
    estimatedCost,
    estimatedGrossMargin,
    operatingExpenses,
    estimatedContribution: estimatedGrossMargin - operatingExpenses,
    productsWithoutCost: products.filter((row) => row.estimatedCost === null).length,
    products
  };
}


export type CatalogProfitabilityRow = {
  productId: string;
  name: string;
  sku: string;
  supplier: string | null;
  supplierUnitCost: number | null;
  salePrice: number;
  unitProfit: number | null;
  markupPercent: number | null;
  stock: number;
  availabilityStatus: string;
};

export type CatalogProfitabilityOverview = {
  available: boolean;
  activeProducts: number;
  productsWithCost: number;
  productsWithoutCost: number;
  totalStock: number;
  inventoryRetailValue: number;
  inventorySupplierCost: number;
  inventoryPotentialGrossProfit: number;
  products: CatalogProfitabilityRow[];
};

export async function getCatalogProfitabilityOverview(): Promise<CatalogProfitabilityOverview> {
  const admin = getSupabaseAdminClient();
  const emptyCatalog: CatalogProfitabilityOverview = {
    available: false,
    activeProducts: 0,
    productsWithCost: 0,
    productsWithoutCost: 0,
    totalStock: 0,
    inventoryRetailValue: 0,
    inventorySupplierCost: 0,
    inventoryPotentialGrossProfit: 0,
    products: []
  };
  if (!admin) return emptyCatalog;

  const productsResult = await admin
    .from("products")
    .select("id,name,sku,price,stock,availability_status")
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(500);

  if (productsResult.error) return emptyCatalog;

  const products = productsResult.data ?? [];
  const productIds = products.map((product) => product.id);
  let sourceRows: Array<{
    product_id: string;
    source: string;
    original_price: number | string;
    margin_percent: number | string;
    checked_at: string | null;
  }> = [];

  if (productIds.length) {
    const sourceResult = await admin
      .from("product_supplier_sources")
      .select("product_id,source,original_price,margin_percent,checked_at")
      .in("product_id", productIds)
      .limit(500);
    if (sourceResult.error) return emptyCatalog;
    sourceRows = sourceResult.data ?? [];
  }

  const sourceByProduct = new Map(sourceRows.map((row) => [row.product_id, row]));
  const rows: CatalogProfitabilityRow[] = products.map((product) => {
    const source = sourceByProduct.get(product.id);
    const salePrice = numeric(product.price);
    const stock = Math.max(0, numeric(product.stock));
    const supplierUnitCost = source ? numeric(source.original_price) : null;
    const unitProfit = supplierUnitCost === null ? null : salePrice - supplierUnitCost;
    const markupPercent = supplierUnitCost && supplierUnitCost > 0 && unitProfit !== null
      ? (unitProfit / supplierUnitCost) * 100
      : null;

    return {
      productId: product.id,
      name: String(product.name ?? "Producto"),
      sku: String(product.sku ?? "-"),
      supplier: source?.source ?? null,
      supplierUnitCost,
      salePrice,
      unitProfit,
      markupPercent,
      stock,
      availabilityStatus: String(product.availability_status ?? "CONSULT")
    };
  });

  const withCost = rows.filter((row) => row.supplierUnitCost !== null);
  return {
    available: true,
    activeProducts: rows.length,
    productsWithCost: withCost.length,
    productsWithoutCost: rows.length - withCost.length,
    totalStock: rows.reduce((sum, row) => sum + row.stock, 0),
    inventoryRetailValue: rows.reduce((sum, row) => sum + row.salePrice * row.stock, 0),
    inventorySupplierCost: withCost.reduce((sum, row) => sum + numeric(row.supplierUnitCost) * row.stock, 0),
    inventoryPotentialGrossProfit: withCost.reduce((sum, row) => sum + numeric(row.unitProfit) * row.stock, 0),
    products: rows
  };
}
