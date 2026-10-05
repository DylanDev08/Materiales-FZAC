import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type DemandLine = {
  productId: string;
  quantity: number;
};

type SupplierLine = {
  productId: string;
  quantity: number;
  unitCost: number;
};

type SupplierSourceRow = {
  product_id: string;
  supplier_id: string;
  original_price: number | string | null;
  checked_at: string | null;
  manual_review_required: boolean | null;
};

function deterministicRequestKey(orderId: string, supplierId: string) {
  const hex = createHash("sha256").update(`fzac-procurement:${orderId}:${supplierId}`).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function ensureSupplierPurchaseOrdersForCustomerOrder(orderId: string, actorId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Supabase admin no esta configurado para generar ordenes de compra.");

  const [{ data: order, error: orderError }, { data: orderItems, error: itemsError }] = await Promise.all([
    admin.from("orders").select("id,status,customer_name,total").eq("id", orderId).maybeSingle(),
    admin.from("order_items").select("product_id,quantity").eq("order_id", orderId)
  ]);

  if (orderError || !order) throw new Error("No pudimos cargar el pedido pagado para generar compras a proveedores.");
  if (itemsError || !orderItems?.length) throw new Error("El pedido no tiene productos para generar compras a proveedores.");

  const paidStatuses = new Set(["PAID", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"]);
  if (!paidStatuses.has(String(order.status))) throw new Error("Las ordenes a proveedores solo se generan despues de confirmar el pago.");

  const soldProductIds = Array.from(new Set(orderItems.map((item) => String(item.product_id)).filter(Boolean)));
  const { data: bundleRows, error: bundleError } = soldProductIds.length
    ? await admin
        .from("product_bundle_items")
        .select("bundle_product_id,component_product_id,quantity")
        .in("bundle_product_id", soldProductIds)
    : { data: [], error: null };
  if (bundleError) throw new Error("No pudimos expandir los combos del pedido.");

  const bundleMap = new Map<string, Array<{ productId: string; quantity: number }>>();
  for (const row of bundleRows ?? []) {
    const key = String(row.bundle_product_id);
    const lines = bundleMap.get(key) ?? [];
    lines.push({ productId: String(row.component_product_id), quantity: Number(row.quantity ?? 1) });
    bundleMap.set(key, lines);
  }

  const demand = new Map<string, number>();
  for (const item of orderItems) {
    const productId = String(item.product_id);
    const soldQuantity = Number(item.quantity ?? 0);
    const components = bundleMap.get(productId);
    if (components?.length) {
      for (const component of components) {
        demand.set(component.productId, (demand.get(component.productId) ?? 0) + soldQuantity * component.quantity);
      }
    } else {
      demand.set(productId, (demand.get(productId) ?? 0) + soldQuantity);
    }
  }

  const demandLines: DemandLine[] = Array.from(demand, ([productId, quantity]) => ({ productId, quantity }));
  const demandIds = demandLines.map((line) => line.productId);

  const [{ data: products, error: productError }, { data: sources, error: sourceError }] = await Promise.all([
    admin.from("products").select("id,name,sku,unit,supplier_id,active").in("id", demandIds),
    admin
      .from("product_supplier_sources")
      .select("product_id,supplier_id,original_price,checked_at,manual_review_required")
      .in("product_id", demandIds)
      .order("checked_at", { ascending: false })
  ]);
  if (productError || sourceError) throw new Error("No pudimos resolver proveedores y costos para el pedido.");

  const productsById = new Map((products ?? []).map((product) => [String(product.id), product]));
  const sourceRows = (sources ?? []) as SupplierSourceRow[];
  const sourcesByProduct = new Map<string, SupplierSourceRow[]>();
  for (const source of sourceRows) {
    const productId = String(source.product_id);
    const current = sourcesByProduct.get(productId) ?? [];
    current.push(source);
    sourcesByProduct.set(productId, current);
  }

  const grouped = new Map<string, SupplierLine[]>();
  const unresolved: string[] = [];

  for (const line of demandLines) {
    const product = productsById.get(line.productId);
    if (!product || product.active === false) {
      unresolved.push(line.productId);
      continue;
    }

    const candidates = sourcesByProduct.get(line.productId) ?? [];
    const preferredSupplierId = product.supplier_id ? String(product.supplier_id) : "";
    const source = candidates.find((candidate) => String(candidate.supplier_id) === preferredSupplierId) ?? candidates[0];
    const supplierId = preferredSupplierId || (source?.supplier_id ? String(source.supplier_id) : "");
    const unitCost = Number(source?.original_price ?? 0);

    if (!supplierId || !Number.isFinite(unitCost) || unitCost <= 0) {
      unresolved.push(String(product.name ?? product.sku ?? line.productId));
      continue;
    }

    const supplierLines = grouped.get(supplierId) ?? [];
    supplierLines.push({ productId: line.productId, quantity: line.quantity, unitCost });
    grouped.set(supplierId, supplierLines);
  }

  if (unresolved.length) {
    throw new Error(`Faltan proveedor o costo de compra para: ${unresolved.join(", ")}.`);
  }

  const created: Array<{ supplierId: string; orderId: string; orderNumber: string }> = [];
  for (const [supplierId, lines] of grouped) {
    const { data, error } = await admin.rpc("create_purchase_order", {
      p_supplier_id: supplierId,
      p_request_key: deterministicRequestKey(orderId, supplierId),
      p_expected_at: null,
      p_notes: `Generada automaticamente desde pedido cliente ${orderId.slice(0, 8).toUpperCase()} luego de confirmar el pago. Revisar costos y disponibilidad antes de enviar al proveedor.`,
      p_items: lines.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        unitCost: line.unitCost
      })),
      p_actor_id: actorId
    });

    if (error) throw new Error(`No pudimos generar la orden de compra del proveedor ${supplierId}.`);
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.order_id) {
      created.push({
        supplierId,
        orderId: String(result.order_id),
        orderNumber: String(result.order_number ?? "")
      });
    }
  }

  return {
    ok: true,
    sourceOrderId: orderId,
    purchaseOrders: created,
    suppliers: grouped.size,
    products: demandLines.length
  };
}
