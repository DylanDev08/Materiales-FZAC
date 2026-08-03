import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type SupplierPaymentMethod = "BANK_TRANSFER" | "CASH" | "CARD" | "OTHER";
export type SupplierInvoiceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "VOID";

export type SupplierPayment = {
  id: string;
  amount: number;
  method: SupplierPaymentMethod;
  reference: string | null;
  paid_at: string;
  notes: string | null;
  status: "ACTIVE" | "VOID";
  void_reason: string | null;
};

export type SupplierInvoice = {
  id: string;
  supplier_id: string;
  purchase_order_id: string;
  invoice_number: string;
  status: SupplierInvoiceStatus;
  amount: number;
  paid_amount: number;
  issued_at: string;
  due_at: string;
  notes: string | null;
  void_reason: string | null;
  created_at: string;
  supplier: { id: string; name: string; code: string } | null;
  purchase_order: { id: string; order_number: string; total: number; status: string } | null;
  payments: SupplierPayment[];
};

export type BillablePurchaseOrder = {
  id: string;
  order_number: string;
  supplier_id: string;
  supplier_name: string;
  status: string;
  total: number;
  invoiced_amount: number;
  remaining_amount: number;
};

export type ProductCostEvolution = {
  product_id: string;
  product_name: string;
  sku: string;
  unit: string;
  latest_cost: number;
  previous_cost: number | null;
  variation_percent: number | null;
  latest_supplier: string;
  latest_order: string;
  latest_at: string;
  observations: number;
};

export type SupplierFinanceData = {
  ready: boolean;
  invoices: SupplierInvoice[];
  billableOrders: BillablePurchaseOrder[];
  costEvolution: ProductCostEvolution[];
  overview: {
    outstanding: number;
    overdue: number;
    dueSoon: number;
    paidThisMonth: number;
    pendingDocuments: number;
  };
};

const emptyData: SupplierFinanceData = {
  ready: false,
  invoices: [],
  billableOrders: [],
  costEvolution: [],
  overview: { outstanding: 0, overdue: 0, dueSoon: 0, paidThisMonth: 0, pendingDocuments: 0 }
};

function singleRelation<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T | undefined) ?? null;
  return (value as T | null) ?? null;
}

function dayStart(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getSupplierFinanceData(): Promise<SupplierFinanceData> {
  const admin = getSupabaseAdminClient();
  if (!admin) return emptyData;

  const [invoiceResult, orderResult, costResult] = await Promise.all([
    admin.from("supplier_invoices")
      .select("id,supplier_id,purchase_order_id,invoice_number,status,amount,paid_amount,issued_at,due_at,notes,void_reason,created_at,supplier:suppliers(id,name,code),purchase_order:purchase_orders(id,order_number,total,status),payments:supplier_payments(id,amount,method,reference,paid_at,notes,status,void_reason)")
      .order("due_at", { ascending: true })
      .limit(1_000),
    admin.from("purchase_orders")
      .select("id,order_number,supplier_id,status,total,supplier:suppliers(id,name),invoices:supplier_invoices(amount,status)")
      .in("status", ["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"])
      .order("created_at", { ascending: false })
      .limit(1_000),
    admin.from("purchase_order_items")
      .select("product_id,product_name,sku,unit,unit_cost,created_at,purchase_order:purchase_orders(id,order_number,status,ordered_at,received_at,created_at,supplier:suppliers(id,name))")
      .order("created_at", { ascending: false })
      .limit(5_000)
  ]);

  if (invoiceResult.error || orderResult.error || costResult.error) return emptyData;

  const invoices = (invoiceResult.data ?? []).map((row) => ({
    ...row,
    amount: Number(row.amount ?? 0),
    paid_amount: Number(row.paid_amount ?? 0),
    supplier: singleRelation<SupplierInvoice["supplier"]>(row.supplier),
    purchase_order: (() => {
      const order = singleRelation<{ id: string; order_number: string; total: number | string; status: string }>(row.purchase_order);
      return order ? { ...order, total: Number(order.total ?? 0) } : null;
    })(),
    payments: ((row.payments ?? []) as SupplierPayment[]).map((payment) => ({ ...payment, amount: Number(payment.amount ?? 0) }))
      .sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime())
  })) as SupplierInvoice[];

  const billableOrders = (orderResult.data ?? []).map((row) => {
    const supplier = singleRelation<{ id: string; name: string }>(row.supplier);
    const invoicedAmount = ((row.invoices ?? []) as Array<{ amount: number | string; status: string }>)
      .filter((invoice) => invoice.status !== "VOID")
      .reduce((sum, invoice) => sum + Number(invoice.amount ?? 0), 0);
    const total = Number(row.total ?? 0);
    return {
      id: String(row.id),
      order_number: String(row.order_number),
      supplier_id: String(row.supplier_id),
      supplier_name: supplier?.name ?? "Proveedor",
      status: String(row.status),
      total,
      invoiced_amount: invoicedAmount,
      remaining_amount: Math.max(0, total - invoicedAmount)
    };
  }).filter((order) => order.remaining_amount > 0) as BillablePurchaseOrder[];

  type CostObservation = {
    product_id: string;
    product_name: string;
    sku: string;
    unit: string;
    unit_cost: number;
    at: string;
    supplier: string;
    order: string;
  };
  const observations = (costResult.data ?? []).flatMap((row) => {
    const order = singleRelation<{
      id: string;
      order_number: string;
      status: string;
      ordered_at: string | null;
      received_at: string | null;
      created_at: string;
      supplier: unknown;
    }>(row.purchase_order);
    if (!order || !["ORDERED", "PARTIALLY_RECEIVED", "RECEIVED"].includes(order.status)) return [];
    const supplier = singleRelation<{ id: string; name: string }>(order.supplier);
    return [{
      product_id: String(row.product_id),
      product_name: String(row.product_name),
      sku: String(row.sku),
      unit: String(row.unit),
      unit_cost: Number(row.unit_cost ?? 0),
      at: order.received_at ?? order.ordered_at ?? order.created_at,
      supplier: supplier?.name ?? "Proveedor",
      order: order.order_number
    } satisfies CostObservation];
  });
  const grouped = new Map<string, CostObservation[]>();
  for (const observation of observations) {
    const current = grouped.get(observation.product_id) ?? [];
    current.push(observation);
    grouped.set(observation.product_id, current);
  }
  const costEvolution = Array.from(grouped.values()).map((rows) => {
    const sorted = rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    const latest = sorted[0];
    const previous = sorted[1] ?? null;
    const variation = previous && previous.unit_cost > 0 ? ((latest.unit_cost - previous.unit_cost) / previous.unit_cost) * 100 : null;
    return {
      product_id: latest.product_id,
      product_name: latest.product_name,
      sku: latest.sku,
      unit: latest.unit,
      latest_cost: latest.unit_cost,
      previous_cost: previous?.unit_cost ?? null,
      variation_percent: variation === null ? null : Math.round(variation * 10) / 10,
      latest_supplier: latest.supplier,
      latest_order: latest.order,
      latest_at: latest.at,
      observations: sorted.length
    };
  }).sort((a, b) => Math.abs(b.variation_percent ?? 0) - Math.abs(a.variation_percent ?? 0));

  const activeInvoices = invoices.filter((invoice) => invoice.status === "PENDING" || invoice.status === "PARTIALLY_PAID");
  const today = dayStart(new Date());
  const dueSoonLimit = new Date(today);
  dueSoonLimit.setDate(dueSoonLimit.getDate() + 7);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const activePayments = invoices.flatMap((invoice) => invoice.payments).filter((payment) => payment.status === "ACTIVE");

  return {
    ready: true,
    invoices,
    billableOrders,
    costEvolution,
    overview: {
      outstanding: activeInvoices.reduce((sum, invoice) => sum + invoice.amount - invoice.paid_amount, 0),
      overdue: activeInvoices.filter((invoice) => dayStart(new Date(`${invoice.due_at}T12:00:00`)) < today).length,
      dueSoon: activeInvoices.filter((invoice) => {
        const due = dayStart(new Date(`${invoice.due_at}T12:00:00`));
        return due >= today && due <= dueSoonLimit;
      }).length,
      paidThisMonth: activePayments.filter((payment) => new Date(payment.paid_at) >= monthStart)
        .reduce((sum, payment) => sum + payment.amount, 0),
      pendingDocuments: billableOrders.length
    }
  };
}
