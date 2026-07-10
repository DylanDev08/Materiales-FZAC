import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { fallbackCategories, fallbackProducts } from "@/lib/db/fallback-data";
import { currency } from "@/lib/formatters/currency";
import { isTestPaymentEnv } from "@/lib/payments/config";
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

function shortReference(value: string | null | undefined) {
  if (!value) return "-";
  return String(value).slice(0, 8).toUpperCase();
}

function friendlyStatus(value: string | null | undefined) {
  const status = String(value ?? "").toUpperCase();
  const labels: Record<string, string> = {
    PAID: "Aprobado",
    APPROVED: "Aprobado",
    COMPLETED: "Completado",
    DELIVERED: "Entregado",
    PENDING: "Pendiente",
    PENDING_PAYMENT: "Pago pendiente",
    PENDING_TRANSFER: "Transferencia pendiente",
    PENDING_ADMIN_APPROVAL: "Requiere revision",
    COORDINATE: "Coordinacion por WhatsApp",
    FAILED: "Denegado",
    REJECTED: "Rechazado",
    CANCELLED: "Cancelado",
    OPEN: "Abierto",
    WAITING_ADMIN: "Revisar",
    CLOSED: "Cerrado"
  };
  return labels[status] ?? (status ? status.replaceAll("_", " ") : "-");
}

function friendlyRole(value: string | null | undefined) {
  const role = String(value ?? "").toUpperCase();
  if (role === "ADMIN") return "Administrador";
  if (role === "OPERATOR") return "Operador";
  return "Cliente";
}

function friendlyProvider(value: string | null | undefined) {
  const provider = String(value ?? "").toUpperCase();
  if (provider === "MERCADOPAGO") return "Mercado Pago";
  if (provider === "BANK_TRANSFER" || provider === "TRANSFER") return "Transferencia pendiente";
  if (provider === "WHATSAPP") return "Coordinacion por WhatsApp";
  if (provider === "MOCK") return "Prueba";
  return provider || "-";
}

function friendlyPaymentMethod(payment: {
  provider?: string | null;
  provider_session_id?: string | null;
  provider_preference_id?: string | null;
}) {
  const session = String(payment.provider_session_id ?? "").toLowerCase();
  if (session.includes("-transfer")) return "Transferencia pendiente";
  if (session.includes("-bank_transfer")) return "Transferencia pendiente";
  if (session.includes("-whatsapp")) return "Coordinacion por WhatsApp";
  if (!payment.provider_preference_id && String(payment.provider ?? "").toUpperCase() === "MERCADOPAGO") return "Mercado Pago pendiente";
  return friendlyProvider(payment.provider);
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
        admin.from("payments").select("order_id,provider,status,provider_payment_id,provider_preference_id,provider_session_id").in("order_id", orderIds)
      ])
    : [{ data: [] }, { data: [] }];

  return (orders ?? []).map((order) => {
    const orderItems = (items ?? []).filter((item) => item.order_id === order.id);
    const payment = (payments ?? []).find((item) => item.order_id === order.id);

    return {
      Id: order.id,
      Referencia: shortReference(order.id),
      Cliente: order.customer_name,
      Email: order.customer_email,
      Telefono: order.customer_phone,
      Productos: orderItems.map((item) => `${item.quantity} x ${item.name}`).join("; ") || "-",
      Total: currency(order.total),
      Estado: friendlyStatus(order.status),
      Pago: payment ? `${friendlyPaymentMethod(payment)} - ${friendlyStatus(payment.status)}` : "Pendiente",
      Envio: order.shipping_method === "DELIVERY" ? "Envio a coordinar" : "Retiro",
      Fecha: adminDate(order.created_at)
    };
  });
}

export async function getAdminPaymentTableRows(limit = 200) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];
  const paymentEnv = isTestPaymentEnv() ? "TEST" : "PROD";

  const { data: payments } = await admin
    .from("payments")
    .select("id,order_id,provider,status,amount,currency,provider_payment_id,provider_preference_id,provider_session_id,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  const orderIds = (payments ?? []).map((payment) => payment.order_id).filter(Boolean);
  const { data: orders } = orderIds.length
    ? await admin.from("orders").select("id,customer_name,customer_email,status,total").in("id", orderIds)
    : { data: [] };

  return (payments ?? []).map((payment) => {
    const order = (orders ?? []).find((item) => item.id === payment.order_id);
    return {
      Estado: friendlyStatus(payment.status),
      Ambiente: paymentEnv,
      Proveedor: friendlyPaymentMethod(payment),
      Monto: currency(payment.amount),
      Referencia: shortReference(payment.order_id),
      Cliente: order?.customer_name ?? "-",
      Email: order?.customer_email ?? "-",
      Fecha: adminDate(payment.created_at)
    };
  });
}

export async function getAdminPaymentEventRows(limit = 200) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const { data: events } = await admin
    .from("payment_events")
    .select("provider,provider_event_id,provider_payment_id,order_id,event_type,status,error_message,created_at,processed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (events ?? []).map((event) => ({
    Estado: friendlyStatus(event.status),
    Proveedor: friendlyProvider(event.provider),
    Evento: event.event_type ?? "-",
    Pedido: shortReference(event.order_id),
    "Referencia Mercado Pago": shortReference(event.provider_payment_id),
    "Evento proveedor": shortReference(event.provider_event_id),
    Error: event.error_message ? String(event.error_message).slice(0, 90) : "-",
    Recibido: adminDate(event.created_at),
    Procesado: adminDate(event.processed_at)
  }));
}

export async function getAdminLogRows(limit = 120) {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const [{ data: notifications }, { data: paymentEvents }, { data: inventory }] = await Promise.all([
    admin.from("notifications").select("type,title,message,link_to,created_at").order("created_at", { ascending: false }).limit(limit),
    admin.from("payment_events").select("status,event_type,error_message,provider_payment_id,order_id,created_at").order("created_at", { ascending: false }).limit(40),
    admin.from("inventory_movements").select("type,quantity,reason,order_id,created_at").order("created_at", { ascending: false }).limit(40)
  ]);

  const rows = [
    ...(notifications ?? []).map((item) => ({
      Tipo: friendlyStatus(item.type),
      Mensaje: item.message || item.title,
      Referencia: item.link_to ? String(item.link_to).split("=").pop() : "-",
      Fecha: adminDate(item.created_at)
    })),
    ...(paymentEvents ?? []).map((item) => ({
      Tipo: `Pago - ${friendlyStatus(item.status)}`,
      Mensaje: item.error_message || `Evento ${item.event_type || "payment"} recibido desde Mercado Pago.`,
      Referencia: shortReference(item.order_id || item.provider_payment_id),
      Fecha: adminDate(item.created_at)
    })),
    ...(inventory ?? []).map((item) => ({
      Tipo: `Stock - ${friendlyStatus(item.type)}`,
      Mensaje: `${item.reason || "Movimiento de inventario"} (${item.quantity ?? 0}).`,
      Referencia: shortReference(item.order_id),
      Fecha: adminDate(item.created_at)
    }))
  ];

  return rows.slice(0, limit);
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
    { data: approvalOrders },
    { data: allOrderRows },
    { data: products },
    { data: payments },
    { data: allProfiles },
    { data: profiles },
    { data: newTodayProfiles },
    { data: chats },
    { data: inventoryMovements },
    { data: paymentEvents },
    { data: recentOrders },
    { data: recentTickets }
  ] = await Promise.all([
    admin.from("orders").select("total, created_at, status").eq("status", "PAID").gte("created_at", today),
    admin.from("orders").select("total, created_at, status").eq("status", "PAID").gte("created_at", month),
    admin.from("orders").select("id,status").eq("status", "PENDING_PAYMENT"),
    admin.from("orders").select("id,status,total").eq("status", "PENDING_ADMIN_APPROVAL"),
    admin.from("orders").select("id,status,total"),
    admin.from("products").select("id, active, stock, stock_minimum").eq("active", true),
    admin.from("payments").select("id,status,amount"),
    admin.from("profiles").select("id,created_at,last_login_at"),
    admin.from("profiles").select("id,created_at,last_login_at").gte("created_at", month),
    admin.from("profiles").select("id,created_at").gte("created_at", today),
    admin.from("chat_conversations").select("id,status").in("status", ["OPEN", "WAITING_ADMIN"]),
    admin.from("inventory_movements").select("id,type,quantity,reason,created_at").order("created_at", { ascending: false }).limit(6),
    admin.from("payment_events").select("id,status,event_type,error_message,created_at").order("created_at", { ascending: false }).limit(6),
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
  const paidOrderCount = (allOrderRows ?? []).filter((order) => order.status === "PAID").length;
  const pendingAmount = (payments ?? [])
    .filter((payment) => payment.status === "PENDING")
    .reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0);
  const lowStock = (products ?? []).filter((product) => Number(product.stock ?? 0) <= Number(product.stock_minimum ?? 0));
  const noStock = (products ?? []).filter((product) => Number(product.stock ?? 0) <= 0);
  const averageTicket = approvedPayments.length
    ? approvedPayments.reduce((sum, payment) => sum + Number(payment.amount ?? 0), 0) / approvedPayments.length
    : 0;

  const recentOrderRows = recentOrders ?? [];
  const statusMap = recentOrderRows.reduce<Record<string, number>>((acc, order) => {
    const status = String(order.status ?? "SIN_ESTADO");
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    metrics: [
      { label: "Ventas del dia", value: currency(salesToday), helper: "Pagos aprobados hoy" },
      { label: "Ventas del mes", value: currency(salesMonth), helper: "Ingresos del ciclo" },
      { label: "Usuarios registrados", value: String(allProfiles?.length ?? 0), helper: `${newTodayProfiles?.length ?? 0} nuevos hoy` },
      { label: "Pedidos pendientes", value: String(pendingOrders?.length ?? 0), helper: "Requieren seguimiento" },
      { label: "Aprobacion admin", value: String(approvalOrders?.length ?? 0), helper: "Compras grandes" },
      { label: "Pedidos pagados", value: String(paidOrderCount), helper: "Ordenes confirmadas" },
      { label: "Pagos pendientes", value: String(pendingPayments.length), helper: "Esperando proveedor" },
      { label: "Total pendiente", value: currency(pendingAmount), helper: "Pagos sin confirmar" },
      { label: "Pagos aprobados", value: String(approvedPayments.length), helper: "Confirmados por proveedor" },
      { label: "Pagos rechazados", value: String(rejectedPayments.length), helper: "Sin stock descontado" },
      { label: "Ticket promedio", value: currency(averageTicket), helper: "Promedio de pagos aprobados" },
      { label: "Clientes nuevos", value: String(profiles?.length ?? 0), helper: "Altas del mes" },
      { label: "Productos activos", value: String(products?.length ?? 0), helper: `${lowStock.length} bajo stock` },
      { label: "Productos sin stock", value: String(noStock.length), helper: "Reponer primero" },
      { label: "Tickets emitidos", value: String(recentTickets?.length ?? 0), helper: "Ultimos registros" },
      { label: "Chats pendientes", value: String(chats?.length ?? 0), helper: "AI o soporte humano" }
    ],
    statusCounts: Object.entries(statusMap).map(([status, count]) => ({ status: friendlyStatus(status), count })),
    recentOrders: (recentOrders ?? []).map((order) => ({
      Cliente: order.customer_name,
      Email: order.customer_email,
      Estado: friendlyStatus(order.status),
      Total: currency(order.total),
      Fecha: adminDate(order.created_at)
    })),
    recentTickets: (recentTickets ?? []).map((ticket) => ({
      Numero: ticket.number,
      Cliente: ticket.customer_name,
      Total: currency(ticket.total),
      Estado: friendlyStatus(ticket.status),
      Fecha: adminDate(ticket.issued_at)
    })),
    recentInventory: (inventoryMovements ?? []).map((movement) => ({
      Tipo: friendlyStatus(movement.type),
      Cantidad: String(movement.quantity ?? 0),
      Motivo: movement.reason ?? "-",
      Fecha: adminDate(movement.created_at)
    })),
    recentPaymentEvents: (paymentEvents ?? []).map((event) => ({
      Estado: friendlyStatus(event.status),
      Evento: event.event_type ?? "-",
      Error: event.error_message ?? "-",
      Fecha: adminDate(event.created_at)
    }))
  };
}

export async function getAdminCustomerRows() {
  const admin = getSupabaseAdminClient();
  if (!admin) return [];

  const [{ data: profiles }, { data: orders }, { data: addresses }, { data: chats }] = await Promise.all([
    admin
      .from("profiles")
      .select("id,email,full_name,phone,avatar_url,role,created_at,last_login_at")
      .order("created_at", { ascending: false })
      .limit(500),
    admin
      .from("orders")
      .select("id,user_id,customer_email,status,total,shipping_method,address_snapshot,created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    admin.from("addresses").select("user_id,street,number,city,province,postal_code").limit(1000),
    admin.from("chat_conversations").select("user_id,status").limit(1000)
  ]);

  const orderIds = (orders ?? []).map((order) => order.id);
  const [{ data: payments }, { data: tickets }] = orderIds.length
    ? await Promise.all([
        admin.from("payments").select("order_id,status,provider,amount,created_at,updated_at").in("order_id", orderIds),
        admin.from("purchase_tickets").select("order_id,number,status,issued_at,total").in("order_id", orderIds)
      ])
    : [{ data: [] }, { data: [] }];

  return (profiles ?? []).map((profile) => {
    const profileOrders = (orders ?? []).filter(
      (order) => order.user_id === profile.id || String(order.customer_email).toLowerCase() === String(profile.email).toLowerCase()
    );
    const paidOrders = profileOrders.filter((order) => ["PAID", "COMPLETED", "DELIVERED"].includes(String(order.status)));
    const pendingOrders = profileOrders.filter((order) => ["PENDING_PAYMENT", "PENDING_ADMIN_APPROVAL"].includes(String(order.status)));
    const cancelledOrders = profileOrders.filter((order) => String(order.status) === "CANCELLED");
    const totalSpent = paidOrders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const averageTicket = paidOrders.length ? totalSpent / paidOrders.length : 0;
    const address = (addresses ?? []).find((item) => item.user_id === profile.id);
    const openChats = (chats ?? []).filter((chat) => chat.user_id === profile.id && chat.status !== "CLOSED").length;
    const lastOrder = profileOrders[0];
    const profilePayments = (payments ?? []).filter((payment) => profileOrders.some((order) => order.id === payment.order_id));
    const approvedPayments = profilePayments.filter((payment) => payment.status === "PAID");
    const pendingPayments = profilePayments.filter((payment) => payment.status === "PENDING");
    const lastPayment = profilePayments[0];
    const profileTickets = (tickets ?? []).filter((ticket) => profileOrders.some((order) => order.id === ticket.order_id));
    const authProvider = profile.avatar_url || String(profile.email).toLowerCase().endsWith("@gmail.com") ? "Gmail" : "Email";
    const frequent = paidOrders.length >= 3 || totalSpent >= 250000;
    const active = Boolean(profile.last_login_at);
    const status = frequent ? "Cliente frecuente" : active ? "Activo" : paidOrders.length ? "Activo" : "Sin compras";
    const recentActivity = [
      profile.last_login_at ? `Inicio de sesion: ${adminDate(profile.last_login_at)}` : null,
      lastOrder ? `Pedido ${shortReference(lastOrder.id)}: ${friendlyStatus(lastOrder.status)} por ${currency(lastOrder.total)}` : null,
      lastPayment ? `Pago: ${friendlyStatus(lastPayment.status)} (${friendlyProvider(lastPayment.provider)})` : null,
      profileTickets[0] ? `Ticket emitido: ${profileTickets[0].number}` : null,
      openChats ? `${openChats} chat(s) pendientes` : null
    ].filter((item): item is string => Boolean(item));

    return {
      Id: profile.id,
      Email: profile.email,
      Nombre: profile.full_name,
      AvatarUrl: profile.avatar_url,
      Telefono: profile.phone,
      Rol: friendlyRole(profile.role),
      AuthProvider: authProvider,
      Verificado: authProvider === "Gmail" ? "Verificado" : "-",
      Registro: adminDate(profile.created_at),
      UltimoLogin: adminDate(profile.last_login_at),
      EstadoCliente: status,
      Compras: paidOrders.length,
      PagosAprobados: approvedPayments.length,
      PagosPendientes: pendingPayments.length,
      PedidosPendientes: pendingOrders.length,
      PedidosCancelados: cancelledOrders.length,
      TotalGastado: currency(totalSpent),
      TotalGastadoNumero: totalSpent,
      TicketPromedio: currency(averageTicket),
      Pedidos: profileOrders.length,
      Direccion: address ? `${address.street} ${address.number}, ${address.city}` : "-",
      Provincia: address?.province ?? "-",
      MetodoEnvio: lastOrder?.shipping_method === "DELIVERY" ? "Envio" : "Retiro",
      Entrega: friendlyStatus(lastOrder?.status),
      UltimoPedido: lastOrder ? adminDate(lastOrder.created_at) : "-",
      UltimoPago: friendlyStatus(lastPayment?.status),
      Chats: openChats,
      Actividad: recentActivity
    };
  });
}
