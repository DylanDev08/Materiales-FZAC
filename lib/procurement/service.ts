import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type ProcurementSupplier = {
  id: string;
  code: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  tax_id: string | null;
  payment_terms: string | null;
  lead_time_days: number;
  notes: string | null;
  active: boolean;
  created_at: string;
};

export type ProcurementProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock: number;
  stock_minimum: number;
};

export type ProcurementOrderItem = {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  quantity: number;
  received_quantity: number;
  unit_cost: number;
  subtotal: number;
};

export type ProcurementOrder = {
  id: string;
  order_number: string;
  supplier_id: string;
  status: "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CANCELLED";
  total: number;
  expected_at: string | null;
  notes: string | null;
  ordered_at: string | null;
  received_at: string | null;
  created_at: string;
  supplier: { id: string; name: string; code: string } | null;
  items: ProcurementOrderItem[];
};

export type ProcurementData = {
  ready: boolean;
  suppliers: ProcurementSupplier[];
  products: ProcurementProduct[];
  orders: ProcurementOrder[];
  overview: {
    drafts: number;
    awaitingReceipt: number;
    partialReceipts: number;
    openCommitment: number;
    activeSuppliers: number;
  };
};

const emptyData: ProcurementData = {
  ready: false,
  suppliers: [],
  products: [],
  orders: [],
  overview: { drafts: 0, awaitingReceipt: 0, partialReceipts: 0, openCommitment: 0, activeSuppliers: 0 }
};

export async function getProcurementData(): Promise<ProcurementData> {
  const admin = getSupabaseAdminClient();
  if (!admin) return emptyData;
  const [suppliersResult, productsResult, ordersResult] = await Promise.all([
    admin.from("suppliers").select("*").order("active", { ascending: false }).order("name").limit(500),
    admin.from("products").select("id,name,sku,unit,stock,stock_minimum").eq("active", true).order("name").limit(2_000),
    admin.from("purchase_orders")
      .select("id,order_number,supplier_id,status,total,expected_at,notes,ordered_at,received_at,created_at,supplier:suppliers(id,name,code),items:purchase_order_items(id,product_id,product_name,sku,unit,quantity,received_quantity,unit_cost,subtotal)")
      .order("created_at", { ascending: false })
      .limit(500)
  ]);
  if (suppliersResult.error || productsResult.error || ordersResult.error) return emptyData;

  const suppliers = (suppliersResult.data ?? []) as ProcurementSupplier[];
  const products = (productsResult.data ?? []).map((row) => ({
    ...row,
    stock: Number(row.stock ?? 0),
    stock_minimum: Number(row.stock_minimum ?? 0)
  })) as ProcurementProduct[];
  const orders = (ordersResult.data ?? []).map((row) => {
    const supplierValue = row.supplier as unknown;
    const supplier = Array.isArray(supplierValue) ? supplierValue[0] ?? null : supplierValue;
    return {
      ...row,
      total: Number(row.total ?? 0),
      supplier: supplier as ProcurementOrder["supplier"],
      items: ((row.items ?? []) as ProcurementOrderItem[]).map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        received_quantity: Number(item.received_quantity),
        unit_cost: Number(item.unit_cost),
        subtotal: Number(item.subtotal)
      }))
    } as ProcurementOrder;
  });
  const openStatuses = new Set(["DRAFT", "ORDERED", "PARTIALLY_RECEIVED"]);

  return {
    ready: true,
    suppliers,
    products,
    orders,
    overview: {
      drafts: orders.filter((order) => order.status === "DRAFT").length,
      awaitingReceipt: orders.filter((order) => order.status === "ORDERED").length,
      partialReceipts: orders.filter((order) => order.status === "PARTIALLY_RECEIVED").length,
      openCommitment: orders.filter((order) => openStatuses.has(order.status)).reduce((sum, order) => sum + order.total, 0),
      activeSuppliers: suppliers.filter((supplier) => supplier.active).length
    }
  };
}
