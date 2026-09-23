import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProfitabilityReportPeriod = "day" | "week" | "month";
export type ProfitabilityReportScope = "all" | "sold" | "issues";

export type CatalogProfitabilityRow = {
  productId: string;
  name: string;
  sku: string;
  supplierName: string | null;
  supplierSource: string | null;
  supplierPrice: number | null;
  configuredMarginPercent: number | null;
  ecommercePrice: number;
  unitGrossProfit: number | null;
  markupPercent: number | null;
  unitsSold: number;
  salesRevenue: number;
  estimatedSupplierCostForSales: number | null;
  estimatedGrossProfit: number | null;
  stock: number;
  availabilityStatus: string;
  hasImage: boolean;
};

export type CatalogProfitabilityReport = {
  available: boolean;
  period: ProfitabilityReportPeriod;
  scope: ProfitabilityReportScope;
  periodStart: string;
  generatedAt: string;
  totalProducts: number;
  productsWithSupplierCost: number;
  productsWithoutSupplierCost: number;
  productsWithoutImage: number;
  unitsSold: number;
  salesRevenue: number;
  coveredSalesRevenue: number;
  coveragePercent: number;
  estimatedSupplierCostForSales: number;
  paymentProviderFees: number;
  estimatedGrossProfit: number;
  estimatedContributionAfterFees: number;
  rows: CatalogProfitabilityRow[];
};

type ProductRow = {
  id: string;
  name: string;
  sku: string;
  price: number | string;
  stock: number | null;
  availability_status: string | null;
  image_url: string | null;
  supplier_id: string | null;
  active: boolean;
};

type SourceRow = {
  product_id: string;
  supplier_id: string | null;
  source: string | null;
  original_price: number | string | null;
  margin_percent: number | string | null;
  checked_at: string | null;
  imported_at: string | null;
};

type SupplierRow = { id: string; name: string; code: string };
type OrderRow = { id: string };
type PaymentRow = { order_id: string; raw: unknown };
type OrderItemRow = {
  order_id: string;
  product_id: string | null;
  quantity: number | string | null;
  unit_price: number | string | null;
  subtotal: number | string | null;
};

function numeric(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function paymentFeeAmount(raw: unknown) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const fees = (raw as Record<string, unknown>).fee_details;
  if (!Array.isArray(fees)) return 0;
  return fees.reduce((sum, fee) => {
    if (!fee || typeof fee !== "object" || Array.isArray(fee)) return sum;
    const amount = Number((fee as Record<string, unknown>).amount ?? 0);
    return Number.isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);
}

function startFor(period: ProfitabilityReportPeriod) {
  const now = new Date();
  if (period === "day") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week") {
    const day = now.getDay() || 7;
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1);
  }
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function readAll<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
) {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

export async function getCatalogProfitabilityReport(
  period: ProfitabilityReportPeriod,
  scope: ProfitabilityReportScope
): Promise<CatalogProfitabilityReport> {
  const admin = getSupabaseAdminClient();
  const periodStart = startFor(period).toISOString();
  const empty: CatalogProfitabilityReport = {
    available: false,
    period,
    scope,
    periodStart,
    generatedAt: new Date().toISOString(),
    totalProducts: 0,
    productsWithSupplierCost: 0,
    productsWithoutSupplierCost: 0,
    productsWithoutImage: 0,
    unitsSold: 0,
    salesRevenue: 0,
    coveredSalesRevenue: 0,
    coveragePercent: 0,
    estimatedSupplierCostForSales: 0,
    paymentProviderFees: 0,
    estimatedGrossProfit: 0,
    estimatedContributionAfterFees: 0,
    rows: []
  };
  if (!admin) return empty;

  try {
    const paidStatuses = ["PAID", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"];
    const [products, sources, suppliers, ordersResult] = await Promise.all([
      readAll<ProductRow>((from, to) =>
        admin
          .from("products")
          .select("id,name,sku,price,stock,availability_status,image_url,supplier_id,active")
          .eq("active", true)
          .order("name", { ascending: true })
          .range(from, to)
      ),
      readAll<SourceRow>((from, to) =>
        admin
          .from("product_supplier_sources")
          .select("product_id,supplier_id,source,original_price,margin_percent,checked_at,imported_at")
          .range(from, to)
      ),
      readAll<SupplierRow>((from, to) =>
        admin.from("suppliers").select("id,name,code").range(from, to)
      ),
      admin
        .from("orders")
        .select("id")
        .in("status", paidStatuses)
        .gte("paid_at", periodStart)
        .limit(2000)
    ]);

    if (ordersResult.error) throw new Error(ordersResult.error.message);
    const orders = (ordersResult.data ?? []) as OrderRow[];
    const [items, payments] = orders.length
      ? await Promise.all([
          readAll<OrderItemRow>((from, to) =>
            admin
              .from("order_items")
              .select("order_id,product_id,quantity,unit_price,subtotal")
              .in("order_id", orders.map((order) => order.id))
              .range(from, to)
          ),
          readAll<PaymentRow>((from, to) =>
            admin
              .from("payments")
              .select("order_id,raw")
              .in("order_id", orders.map((order) => order.id))
              .range(from, to)
          )
        ])
      : [[], []] as [OrderItemRow[], PaymentRow[]];

    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
    const sourceByProduct = new Map<string, SourceRow>();
    for (const source of sources) {
      const current = sourceByProduct.get(source.product_id);
      const sourceDate = Date.parse(source.checked_at ?? source.imported_at ?? "1970-01-01");
      const currentDate = current ? Date.parse(current.checked_at ?? current.imported_at ?? "1970-01-01") : -1;
      if (!current || sourceDate >= currentDate) sourceByProduct.set(source.product_id, source);
    }

    const salesByProduct = new Map<string, { units: number; revenue: number }>();
    for (const item of items) {
      if (!item.product_id) continue;
      const quantity = numeric(item.quantity);
      const revenue = numeric(item.subtotal) || numeric(item.unit_price) * quantity;
      const current = salesByProduct.get(item.product_id) ?? { units: 0, revenue: 0 };
      current.units += quantity;
      current.revenue += revenue;
      salesByProduct.set(item.product_id, current);
    }

    const allRows: CatalogProfitabilityRow[] = products.map((product) => {
      const source = sourceByProduct.get(product.id);
      const supplier = supplierById.get(source?.supplier_id ?? product.supplier_id ?? "");
      const supplierPrice = source?.original_price == null ? null : numeric(source.original_price);
      const ecommercePrice = numeric(product.price);
      const unitGrossProfit = supplierPrice && supplierPrice > 0 ? ecommercePrice - supplierPrice : null;
      const markupPercent = supplierPrice && supplierPrice > 0 && unitGrossProfit !== null
        ? (unitGrossProfit / supplierPrice) * 100
        : null;
      const sales = salesByProduct.get(product.id) ?? { units: 0, revenue: 0 };
      const estimatedSupplierCostForSales = supplierPrice !== null ? supplierPrice * sales.units : null;
      const estimatedGrossProfit = estimatedSupplierCostForSales === null
        ? null
        : sales.revenue - estimatedSupplierCostForSales;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        supplierName: supplier?.name ?? null,
        supplierSource: source?.source ?? null,
        supplierPrice,
        configuredMarginPercent: source?.margin_percent == null ? null : numeric(source.margin_percent),
        ecommercePrice,
        unitGrossProfit,
        markupPercent,
        unitsSold: sales.units,
        salesRevenue: sales.revenue,
        estimatedSupplierCostForSales,
        estimatedGrossProfit,
        stock: Number(product.stock ?? 0),
        availabilityStatus: String(product.availability_status ?? "OUT_OF_STOCK"),
        hasImage: Boolean(String(product.image_url ?? "").trim())
      };
    });

    const rows = allRows
      .filter((row) => {
        if (scope === "sold") return row.unitsSold > 0;
        if (scope === "issues") {
          return row.supplierPrice === null || !row.hasImage || row.unitGrossProfit === null || row.unitGrossProfit <= 0;
        }
        return true;
      })
      .sort((left, right) => {
        if (scope === "issues") {
          const leftProfit = left.unitGrossProfit ?? Number.NEGATIVE_INFINITY;
          const rightProfit = right.unitGrossProfit ?? Number.NEGATIVE_INFINITY;
          if (leftProfit !== rightProfit) return leftProfit - rightProfit;
        }
        return left.name.localeCompare(right.name, "es-AR");
      });

    const productsWithSupplierCost = allRows.filter((row) => row.supplierPrice !== null).length;
    const unitsSold = allRows.reduce((sum, row) => sum + row.unitsSold, 0);
    const salesRevenue = allRows.reduce((sum, row) => sum + row.salesRevenue, 0);
    const coveredRows = allRows.filter((row) => row.estimatedSupplierCostForSales !== null);
    const coveredSalesRevenue = coveredRows.reduce((sum, row) => sum + row.salesRevenue, 0);
    const estimatedSupplierCostForSales = coveredRows.reduce(
      (sum, row) => sum + (row.estimatedSupplierCostForSales ?? 0),
      0
    );
    const estimatedGrossProfit = coveredRows.reduce(
      (sum, row) => sum + (row.estimatedGrossProfit ?? 0),
      0
    );
    const paymentProviderFees = payments.reduce((sum, payment) => sum + paymentFeeAmount(payment.raw), 0);

    return {
      available: true,
      period,
      scope,
      periodStart,
      generatedAt: new Date().toISOString(),
      totalProducts: allRows.length,
      productsWithSupplierCost,
      productsWithoutSupplierCost: allRows.length - productsWithSupplierCost,
      productsWithoutImage: allRows.filter((row) => !row.hasImage).length,
      unitsSold,
      salesRevenue,
      coveredSalesRevenue,
      coveragePercent: salesRevenue > 0 ? (coveredSalesRevenue / salesRevenue) * 100 : 0,
      estimatedSupplierCostForSales,
      paymentProviderFees,
      estimatedGrossProfit,
      estimatedContributionAfterFees: estimatedGrossProfit - paymentProviderFees,
      rows
    };
  } catch {
    return empty;
  }
}
