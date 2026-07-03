import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { fallbackCategories, fallbackProducts } from "@/lib/db/fallback-data";
import { currency } from "@/lib/formatters/currency";
import { resolveProductImageUrl } from "@/lib/products/images";
import type { Category, Product } from "@/types/domain";

function normalizeProduct(row: Record<string, unknown>): Product {
  const product = {
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
    unit: String(row.unit ?? "unidad"),
    image_url: String(row.image_url ?? ""),
    gallery: Array.isArray(row.gallery) ? (row.gallery as string[]) : [],
    specifications: (row.specifications as Product["specifications"]) ?? {},
    featured: Boolean(row.featured),
    on_sale: Boolean(row.on_sale),
    active: Boolean(row.active ?? true)
  };

  return { ...product, image_url: resolveProductImageUrl(product) };
}

function normalizeCategory(row: Record<string, unknown>): Category {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description ?? ""),
    image_url: (row.image_url ?? null) as string | null,
    parent_id: (row.parent_id ?? null) as string | null,
    active: Boolean(row.active ?? true),
    sort_order: Number(row.sort_order ?? 0)
  };
}

export async function getAdminProducts() {
  const admin = getSupabaseAdminClient();
  if (!admin) return fallbackProducts;

  const { data } = await admin.from("products").select("*").order("created_at", { ascending: false }).limit(300);
  return data?.map(normalizeProduct) ?? fallbackProducts;
}

export async function getAdminCategories() {
  const admin = getSupabaseAdminClient();
  if (!admin) return fallbackCategories;

  const { data } = await admin.from("categories").select("*").order("sort_order", { ascending: true }).limit(300);
  return data?.map(normalizeCategory) ?? fallbackCategories;
}

export async function getAdminRows(table: string, limit = 200) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data } = await admin.from(table).select("*").order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as Array<Record<string, string | number | null | undefined>>;
}

export async function getAdminOrderTableRows(limit = 200) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data: orders } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orderIds = (orders ?? []).map((order) => order.id);
  const [{ data: items }, { data: payments }] = orderIds.length
    ? await Promise.all([
        admin.from("order_items").select("order_id,name,quantity").in("order_id", orderIds),
        admin.from("payments").select("order_id,provider,status,provider_payment_id").in("order_id", orderIds)
      ])
    : [{ data: [] }, { data: [] }];

  return (orders ?? []).map((order) => {
    const orderItems = (items ?? []).filter((item) => item.order_id === order.id);
    const payment = (payments ?? []).find((item) => item.order_id === order.id);

    return {
      Cliente: order.customer_name,
      Email: order.customer_email,
      Telefono: order.customer_phone,
      Productos: orderItems.map((item) => `${item.quantity} x ${item.name}`).join("; ") || "-",
      Total: currency(order.total),
      Estado: order.status,
      Pago: payment ? `${payment.provider} / ${payment.status}` : "Pendiente",
      Envio: order.shipping_method === "DELIVERY" ? "Envio a coordinar" : "Retiro",
      Fecha: adminDate(order.created_at)
    };
  });
}

export async function getAdminPaymentTableRows(limit = 200) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data: payments } = await admin
    .from("payments")
    .select("id,order_id,provider,status,amount,currency,provider_payment_id,provider_preference_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orderIds = (payments ?? []).map((payment) => payment.order_id).filter(Boolean);
  const { data: orders } = orderIds.length
    ? await admin.from("orders").select("id,customer_name,customer_email,status,total").in("id", orderIds)
    : { data: [] };

  return (payments ?? []).map((payment) => {
    const order = (orders ?? []).find((item) => item.id === payment.order_id);
    return {
      Estado: payment.status,
      Proveedor: payment.provider,
      Monto: currency(payment.amount),
      Orden: payment.order_id,
      Cliente: order?.customer_name ?? "-",
      Email: order?.customer_email ?? "-",
      ProviderPaymentId: payment.provider_payment_id ?? "-",
      PreferenceId: payment.provider_preference_id ?? "-",
      Fecha: adminDate(payment.created_at)
    };
  });
}

function startOfDay() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function adminDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export async function getAdminDashboardData() {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      metrics: [
        { label: "Ventas del dia", value: currency(0), helper: "Backend administrativo sin conexion" },
        { label: "Ventas del mes", value: currency(0), helper: "Esperando pagos aprobados" },
        { label: "Pedidos pendientes", value: "0", helper: "Sin datos" },
        { label: "Clientes nuevos", value: "0", helper: "Sin datos" }
      ],
      statusCounts: [],
      recentOrders: [],
      recentTickets: []
    };
  }

  const today = startOfDay();
  const month = startOfMonth();

  const [
    { data: paidOrders },
    { data: monthOrders },
    { data: pendingOrders },
    { data: products },
    { data: payments },
    { data: profiles },
    { data: chats },
    { data: recentOrders },
    { data: recentTickets }
  ] = await Promise.all([
    admin.from("orders").select("total, created_at, status").eq("status", "PAID").gte("created_at", today),
    admin.from("orders").select("total, created_at, status").eq("status", "PAID").gte("created_at", month),
    admin.from("orders").select("id,status").eq("status", "PENDING_PAYMENT"),
    admin.from("products").select("id, active, stock, stock_minimum").eq("active", true),
    admin.from("payments").select("id,status,amount"),
    admin.from("profiles").select("id,created_at,last_login_at").gte("created_at", month),
    admin.from("chat_conversations").select("id,status").in("status", ["OPEN", "WAITING_ADMIN"]),
    admin
      .from("orders")
      .select("id,customer_name,customer_email,status,total,created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("purchase_tickets")
      .select("id,number,customer_name,total,status,issued_at")
      .order("issued_at", { ascending: false })
      .limit(8)
  ]);

  const salesToday = (paidOrders ?? []).reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const salesMonth = (monthOrders ?? []).reduce((sum, order) => sum + Number(order.total ?? 0), 0);
  const approvedPayments = (payments ?? []).filter((payment) => payment.status === "PAID");
  const pendingPayments = (payments ?? []).filter((payment) => payment.status === "PENDING");
  const rejectedPayments = (payments ?? []).filter((payment) => payment.status === "FAILED");
  const lowStock = (products ?? []).filter((product) => Number(product.stock ?? 0) <= Number(product.stock_minimum ?? 0));
  const averageTicket = approvedPayments.length
    ? approvedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) / approvedPayments.length
    : 0;

  const allOrders = recentOrders ?? [];
  const statusMap = allOrders.reduce<Record<string, number>>((acc, order) => {
    const status = String(order.status ?? "SIN_ESTADO");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    metrics: [
      { label: "Ventas del dia", value: currency(salesToday), helper: "Pagos aprobados hoy" },
      { label: "Ventas del mes", value: currency(salesMonth), helper: "Ingresos del ciclo" },
      { label: "Pedidos pendientes", value: String(pendingOrders?.length ?? 0), helper: "Requieren seguimiento" },
      { label: "Pagos pendientes", value: String(pendingPayments.length), helper: "Esperando proveedor" },
      { label: "Pagos aprobados", value: String(approvedPayments.length), helper: "Confirmados por proveedor" },
      { label: "Pagos rechazados", value: String(rejectedPayments.length), helper: "Sin stock descontado" },
      { label: "Ticket promedio", value: currency(averageTicket), helper: "Promedio de pagos aprobados" },
      { label: "Clientes nuevos", value: String(profiles?.length ?? 0), helper: "Altas del mes" },
      { label: "Productos activos", value: String(products?.length ?? 0), helper: `${lowStock.length} con bajo stock` },
      { label: "Chats pendientes", value: String(chats?.length ?? 0), helper: "AI o soporte humano" }
    ],
    statusCounts: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    recentOrders: (recentOrders ?? []).map((order) => ({
      Cliente: order.customer_name,
      Email: order.customer_email,
      Estado: order.status,
      Total: currency(order.total),
      Fecha: order.created_at
    })),
    recentTickets: (recentTickets ?? []).map((ticket) => ({
      Numero: ticket.number,
      Cliente: ticket.customer_name,
      Total: currency(ticket.total),
      Estado: ticket.status,
      Fecha: ticket.issued_at
    }))
  };
}

export async function getAdminCustomerRows() {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const [{ data: profiles }, { data: orders }, { data: addresses }, { data: chats }] = await Promise.all([
    admin.from("profiles").select("id,email,full_name,phone,role,created_at,last_login_at").order("created_at", { ascending: false }).limit(500),
    admin
      .from("orders")
      .select("id,user_id,customer_email,status,total,shipping_method,address_snapshot,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("addresses").select("user_id,street,number,city,province,postal_code").limit(1000),
    admin.from("chat_conversations").select("user_id,status").limit(1000)
  ]);

  return (profiles ?? []).map((profile) => {
    const profileOrders = (orders ?? []).filter(
      (order) => order.user_id === profile.id || String(order.customer_email).toLowerCase() === String(profile.email).toLowerCase()
    );
    const paidOrders = profileOrders.filter((order) => ["PAID", "COMPLETED", "DELIVERED"].includes(String(order.status)));
    const totalSpent = paidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const address = (addresses ?? []).find((item) => item.user_id === profile.id);
    const openChats = (chats ?? []).filter((chat) => chat.user_id === profile.id && chat.status !== "CLOSED").length;
    const lastOrder = profileOrders[0];

    return {
      Email: profile.email,
      Nombre: profile.full_name,
      Telefono: profile.phone,
      Rol: profile.role,
      Registro: adminDate(profile.created_at),
      UltimoLogin: adminDate(profile.last_login_at),
      Compras: paidOrders.length,
      TotalGastado: currency(totalSpent),
      Pedidos: profileOrders.length,
      Direccion: address ? `${address.street} ${address.number}, ${address.city}` : "-",
      Provincia: address?.province ?? "-",
      Entrega: lastOrder?.status ?? "-",
      Chats: openChats
    };
  });
}
