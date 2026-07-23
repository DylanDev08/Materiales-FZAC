import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { currency } from "@/lib/formatters/currency";
import type { SessionProfile } from "@/lib/auth/get-user";

type OrderRow = {
  id: string;
  status: string | null;
  total: number | string | null;
  subtotal: number | string | null;
  shipping_cost: number | string | null;
  shipping_method: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  created_at: string | null;
};

type OrderItemRow = {
  order_id: string;
  product_id: string | null;
  sku: string | null;
  name: string | null;
  unit_price: number | string | null;
  subtotal: number | string | null;
  quantity: number | string | null;
  image_url: string | null;
};

type ProductStockRow = {
  id: string;
  stock: number | string | null;
  unit: string | null;
};

type ConsumerRequestRow = {
  id: string;
  request_number: string;
  order_number: string | null;
  reason: string | null;
  status: string | null;
  resolution_note: string | null;
  created_at: string | null;
};

const paidStatuses = new Set(["PAID", "CONFIRMED", "PREPARING", "READY_FOR_PICKUP", "OUT_FOR_DELIVERY", "DELIVERED", "COMPLETED"]);
const pendingStatuses = new Set(["PENDING_PAYMENT", "PENDING_ADMIN_APPROVAL", "PENDING_TRANSFER", "COORDINATE"]);

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function shortDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

function mergeOrders(...groups: Array<OrderRow[] | null | undefined>) {
  const map = new Map<string, OrderRow>();
  groups.flatMap((group) => group ?? []).forEach((order) => {
    if (order?.id) map.set(order.id, order);
  });
  return Array.from(map.values()).sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));
}

export type AccountOverview = {
  balance: string;
  totalSpent: string;
  pendingAmount: string;
  ordersCount: number;
  purchasedProducts: number;
  reservedProducts: number;
  lastOrderDate: string;
  addresses: Array<{
    id: string;
    label: string;
    street: string;
    number: string;
    apartment: string;
    city: string;
    province: string;
    postalCode: string;
    notes: string;
  }>;
  orders: Array<{
    id: string;
    status: string;
    total: string;
    date: string;
    delivery: string;
  }>;
  products: Array<{
    sku: string;
    name: string;
    quantity: number;
    total: string;
    imageUrl: string;
    stock: string;
  }>;
  conversations: Array<{
    id: string;
    status: string;
    subject: string;
    lastMessageAt: string;
  }>;
  consumerRequests: Array<{
    id: string;
    requestNumber: string;
    orderNumber: string;
    reason: string;
    status: string;
    resolutionNote: string;
    createdAt: string;
  }>;
};

export async function getAccountOverview(profile: SessionProfile): Promise<AccountOverview> {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return {
      balance: currency(0),
      totalSpent: currency(0),
      pendingAmount: currency(0),
      ordersCount: 0,
      purchasedProducts: 0,
      reservedProducts: 0,
      lastOrderDate: "-",
      addresses: [],
      orders: [],
      products: [],
      conversations: [],
      consumerRequests: []
    };
  }

  const [
    { data: ordersByUser },
    { data: ordersByEmail },
    { data: addresses },
    { data: conversations },
    { data: consumerRequestsByUser },
    { data: consumerRequestsByEmail }
  ] = await Promise.all([
    admin
      .from("orders")
      .select("id,status,total,subtotal,shipping_cost,shipping_method,customer_email,customer_name,customer_phone,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("orders")
      .select("id,status,total,subtotal,shipping_cost,shipping_method,customer_email,customer_name,customer_phone,created_at")
      .eq("customer_email", profile.email)
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("addresses")
      .select("id,label,street,number,apartment,city,province,postal_code,notes")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(6),
    admin
      .from("chat_conversations")
      .select("id,status,subject,last_message_at")
      .eq("user_id", profile.id)
      .order("last_message_at", { ascending: false })
      .limit(6),
    admin
      .from("consumer_refund_requests")
      .select("id,request_number,order_number,reason,status,resolution_note,created_at")
      .eq("user_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(20),
    admin
      .from("consumer_refund_requests")
      .select("id,request_number,order_number,reason,status,resolution_note,created_at")
      .eq("email", profile.email)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  const orders = mergeOrders(ordersByUser as OrderRow[] | null, ordersByEmail as OrderRow[] | null);
  const orderIds = orders.map((order) => order.id);

  const { data: items } = orderIds.length
    ? await admin
        .from("order_items")
        .select("order_id,product_id,sku,name,unit_price,subtotal,quantity,image_url")
        .in("order_id", orderIds)
        .limit(400)
    : { data: [] as OrderItemRow[] };

  const itemRows = (items ?? []) as OrderItemRow[];
  const productIds = Array.from(new Set(itemRows.map((item) => item.product_id).filter(Boolean))) as string[];
  const { data: stockRows } = productIds.length
    ? await admin.from("products").select("id,stock,unit").in("id", productIds).limit(400)
    : { data: [] as ProductStockRow[] };

  const stockList = (stockRows ?? []) as ProductStockRow[];
  const stockByProduct = new Map(stockList.map((product) => [product.id, product]));
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const paidOrderIds = new Set(orders.filter((order) => paidStatuses.has(String(order.status))).map((order) => order.id));
  const pendingOrderIds = new Set(orders.filter((order) => pendingStatuses.has(String(order.status))).map((order) => order.id));
  const paidItems = itemRows.filter((item) => paidOrderIds.has(item.order_id));
  const pendingItems = itemRows.filter((item) => pendingOrderIds.has(item.order_id));
  const consumerRequestMap = new Map<string, ConsumerRequestRow>();
  [...((consumerRequestsByUser ?? []) as ConsumerRequestRow[]), ...((consumerRequestsByEmail ?? []) as ConsumerRequestRow[])]
    .forEach((consumerRequest) => consumerRequestMap.set(consumerRequest.id, consumerRequest));
  const consumerRequests = Array.from(consumerRequestMap.values())
    .sort((a, b) => Date.parse(b.created_at ?? "") - Date.parse(a.created_at ?? ""));

  const totalSpent = orders
    .filter((order) => paidStatuses.has(String(order.status)))
    .reduce((sum, order) => sum + numberValue(order.total), 0);
  const pendingAmount = orders
    .filter((order) => pendingStatuses.has(String(order.status)))
    .reduce((sum, order) => sum + numberValue(order.total), 0);

  return {
    balance: currency(0),
    totalSpent: currency(totalSpent),
    pendingAmount: currency(pendingAmount),
    ordersCount: orders.length,
    purchasedProducts: paidItems.reduce((sum, item) => sum + numberValue(item.quantity), 0),
    reservedProducts: pendingItems.reduce((sum, item) => sum + numberValue(item.quantity), 0),
    lastOrderDate: shortDate(orders[0]?.created_at),
    addresses: (addresses ?? []).map((address) => ({
      id: String(address.id),
      label: String(address.label ?? "Principal"),
      street: String(address.street ?? ""),
      number: String(address.number ?? ""),
      apartment: String(address.apartment ?? ""),
      city: String(address.city ?? ""),
      province: String(address.province ?? ""),
      postalCode: String(address.postal_code ?? ""),
      notes: String(address.notes ?? "")
    })),
    orders: orders.slice(0, 8).map((order) => ({
      id: order.id,
      status: String(order.status ?? "SIN_ESTADO"),
      total: currency(numberValue(order.total)),
      date: shortDate(order.created_at),
      delivery: order.shipping_method === "DELIVERY" ? "Coordinar por WhatsApp" : "Retiro coordinado"
    })),
    products: paidItems.slice(0, 10).map((item) => {
      const order = ordersById.get(item.order_id);
      const stock = item.product_id ? stockByProduct.get(item.product_id) : null;
      const quantity = numberValue(item.quantity);

      return {
        sku: String(item.sku ?? "-"),
        name: String(item.name ?? "Producto"),
        quantity,
        total: currency(numberValue(item.subtotal) || numberValue(item.unit_price) * quantity),
        imageUrl: String(item.image_url || "/logoFZAC.jpg"),
        stock: stock ? `${stock.stock ?? 0} ${stock.unit ?? "un."}` : order?.status ?? "-"
      };
    }),
    conversations: (conversations ?? []).map((conversation) => ({
      id: String(conversation.id),
      status: String(conversation.status ?? "OPEN"),
      subject: String(conversation.subject ?? "Consulta FZAC"),
      lastMessageAt: shortDate(conversation.last_message_at)
    })),
    consumerRequests: consumerRequests.map((consumerRequest) => ({
      id: consumerRequest.id,
      requestNumber: consumerRequest.request_number,
      orderNumber: String(consumerRequest.order_number ?? ""),
      reason: String(consumerRequest.reason ?? "OTHER"),
      status: String(consumerRequest.status ?? "RECEIVED"),
      resolutionNote: String(consumerRequest.resolution_note ?? ""),
      createdAt: shortDate(consumerRequest.created_at)
    }))
  };
}
