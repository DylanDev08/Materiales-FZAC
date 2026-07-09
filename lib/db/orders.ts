import "server-only";

import { getCurrentUser } from "@/lib/auth/get-user";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import { createMercadoPagoPreference, getMercadoPagoPreference, isMercadoPagoEnabled } from "@/lib/payments/mercadopago";
import { resolveProductImageUrl } from "@/lib/products/images";
import { quoteDeliveryForAddress, type ShippingQuote } from "@/lib/shipping/quote";
import {
  notifyAdminLargePurchase,
  notifyAdminNewOrder,
  notifyAdminPaymentPending
} from "@/lib/notifications/admin-notifier";
import { getEnv } from "@/lib/utils/env";
import type { PaymentProvider, Product } from "@/types/domain";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type StockIssue = {
  productId: string;
  requested: number;
  available: number;
  name?: string;
};

export class InsufficientStockError extends Error {
  items: StockIssue[];

  constructor(items: StockIssue[]) {
    super("No hay stock suficiente para completar la compra.");
    this.name = "InsufficientStockError";
    this.items = items;
  }
}

export class ShippingQuoteError extends Error {
  quote?: ShippingQuote;

  constructor(message: string, quote?: ShippingQuote) {
    super(message);
    this.name = "ShippingQuoteError";
    this.quote = quote;
  }
}

function isUuid(value: string | undefined | null) {
  return UUID_PATTERN.test(String(value ?? ""));
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean))) as string[];
}

function enrichLegacyItem(item: CheckoutInput["items"][number]) {
  if (item.sku || item.slug) return item;
  const fallback = fallbackProducts.find((product) => product.id === item.productId);
  return fallback ? { ...item, sku: fallback.sku, slug: fallback.slug } : item;
}

function fallbackProductForItem(item: CheckoutInput["items"][number]) {
  const normalizedSku = item.sku?.toLowerCase();
  const normalizedSlug = item.slug?.toLowerCase();
  return fallbackProducts.find(
    (product) =>
      product.id === item.productId ||
      Boolean(normalizedSku && product.sku.toLowerCase() === normalizedSku) ||
      Boolean(normalizedSlug && product.slug.toLowerCase() === normalizedSlug)
  );
}

function itemDisplayName(item: CheckoutInput["items"][number], product?: Product) {
  return product?.name ?? fallbackProductForItem(item)?.name ?? item.sku ?? item.slug ?? item.productId;
}

function matchesItem(product: Product, item: CheckoutInput["items"][number]) {
  return (
    product.id === item.productId ||
    Boolean(item.sku && product.sku.toLowerCase() === item.sku.toLowerCase()) ||
    Boolean(item.slug && product.slug.toLowerCase() === item.slug.toLowerCase())
  );
}

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

function purchaseAutoApprovalLimit() {
  const configured = Number(getEnv("PURCHASE_AUTO_APPROVAL_LIMIT"));
  return Number.isFinite(configured) && configured > 0 ? configured : 250000;
}

function checkoutSuccessResponse(input: {
  orderId: string;
  paymentId: string;
  orderStatus: string;
  requiresAdminApproval: boolean;
  total: number;
  provider: PaymentProvider;
  preference?: Awaited<ReturnType<typeof createMercadoPagoPreference>> | null;
  pending?: boolean;
  card?: boolean;
  message?: string;
}) {
  return {
    ok: true,
    status: 201,
    message: input.message ?? "Compra creada correctamente.",
    orderId: input.orderId,
    order_id: input.orderId,
    paymentId: input.paymentId,
    payment_id: input.paymentId,
    order_status: input.orderStatus,
    requires_admin_approval: input.requiresAdminApproval,
    ...(input.preference
      ? {
          url: input.preference.redirect_url,
          redirect_url: input.preference.redirect_url,
          init_point: input.preference.init_point,
          sandbox_init_point: input.preference.sandbox_init_point,
          preference_id: input.preference.preference_id
        }
      : {}),
    ...(input.pending ? { pending: true } : {}),
    ...(input.card ? { card: true } : {}),
    total: input.total,
    provider: input.provider
  };
}

async function getProductsForItems(items: CheckoutInput["items"]) {
  const admin = getSupabaseAdminClient();
  const normalizedItems = items.map(enrichLegacyItem);
  const requestedIds = unique(normalizedItems.map((item) => item.productId));
  const uuidIds = requestedIds.filter(isUuid);
  const skus = unique(normalizedItems.map((item) => item.sku));
  const slugs = unique(normalizedItems.map((item) => item.slug));
  let products: Product[] = [];

  if (admin) {
    const queries = [];

    if (uuidIds.length) {
      queries.push(admin.from("products").select("*").in("id", uuidIds).eq("active", true));
    }
    if (skus.length) {
      queries.push(admin.from("products").select("*").in("sku", skus).eq("active", true));
    }
    if (slugs.length) {
      queries.push(admin.from("products").select("*").in("slug", slugs).eq("active", true));
    }

    const responses = await Promise.all(queries);
    const error = responses.find((response) => response.error)?.error;
    if (error) throw new Error("No pudimos validar los productos del carrito.");

    const byId = new Map<string, Product>();
    responses
      .flatMap((response) => response.data ?? [])
      .map(normalizeProduct)
      .forEach((product) => byId.set(product.id, product));

    products = Array.from(byId.values());
  } else {
    products = fallbackProducts.filter((product) => normalizedItems.some((item) => matchesItem(product, item)));
  }

  return { admin, products, items: normalizedItems };
}

async function resumeCheckoutByIdempotencyKey(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  idempotencyKey: string,
  provider: PaymentProvider,
  paymentFlow?: CheckoutInput["paymentFlow"]
) {
  // TODO(prod-db): for a hard cross-container guarantee, add a unique DB constraint
  // or RPC lock on payments.provider_session_id. This pass avoids SQL/RLS changes by request.
  const { data: payment } = await admin
    .from("payments")
    .select("id,order_id,provider,status,amount,provider_preference_id")
    .eq("provider_session_id", idempotencyKey)
    .maybeSingle();

  if (!payment?.order_id) return null;

  const { data: order } = await admin
    .from("orders")
    .select(
      "id,status,customer_name,customer_email,customer_phone,shipping_cost,total"
    )
    .eq("id", payment.order_id)
    .maybeSingle();

  if (!order || String(order.status) === "CANCELLED") return null;

  if (String(order.status) === "PENDING_ADMIN_APPROVAL") {
    return checkoutSuccessResponse({
      orderId: order.id,
      paymentId: payment.id,
      orderStatus: String(order.status),
      requiresAdminApproval: true,
      pending: true,
      total: Number(order.total ?? payment.amount ?? 0),
      provider,
      message: "Compra creada correctamente. Requiere aprobacion del administrador."
    });
  }

  if (paymentFlow === "CARD") {
    return checkoutSuccessResponse({
      orderId: order.id,
      paymentId: payment.id,
      orderStatus: String(order.status),
      requiresAdminApproval: false,
      pending: true,
      card: true,
      total: Number(order.total ?? payment.amount ?? 0),
      provider
    });
  }

  let preference = payment.provider_preference_id
    ? await getMercadoPagoPreference(String(payment.provider_preference_id)).catch(() => null)
    : null;

  if (!preference && provider === "MERCADOPAGO" && isMercadoPagoEnabled()) {
    const { data: orderItems } = await admin
      .from("order_items")
      .select("product_id,sku,name,price,quantity,image_url")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const items = (orderItems ?? []).map((item) => ({
      product: {
        id: String(item.product_id ?? item.sku ?? item.name),
        name: String(item.name),
        price: Number(item.price ?? 0),
        image_url: String(item.image_url ?? "")
      },
      quantity: Number(item.quantity ?? 1)
    }));

    preference = await createMercadoPagoPreference({
      orderId: order.id,
      customer: {
        name: String(order.customer_name),
        email: String(order.customer_email),
        phone: String(order.customer_phone)
      },
      items,
      shippingCost: Number(order.shipping_cost ?? 0),
      total: Number(order.total ?? payment.amount ?? 0),
      idempotencyKey
    });

    await admin
      .from("payments")
      .update({ provider_preference_id: preference.preference_id, updated_at: new Date().toISOString() })
      .eq("id", payment.id);
  }

  return checkoutSuccessResponse({
    orderId: order.id,
    paymentId: payment.id,
    orderStatus: String(order.status),
    requiresAdminApproval: false,
    preference,
    pending: !preference,
    total: Number(order.total ?? payment.amount ?? 0),
    provider
  });
}

export async function validateCheckoutStock(input: unknown) {
  const payload = checkoutSchema.pick({ items: true }).parse(input);
  const { products, items } = await getProductsForItems(payload.items);

  const issues = items.flatMap((item) => {
    const product = products.find((candidate) => matchesItem(candidate, item));
    const available = product?.stock ?? 0;
    if (!product || item.quantity > available) {
      return [{ productId: item.productId, requested: item.quantity, available, name: itemDisplayName(item, product) }];
    }
    return [];
  });

  if (issues.length) throw new InsufficientStockError(issues);

  return { ok: true };
}

export async function createCheckout(input: unknown) {
  const payload = checkoutSchema.parse(input);
  const provider: PaymentProvider = payload.paymentProvider === "NARANJAX" ? "NARANJAX" : "MERCADOPAGO";
  const idempotencyKey = payload.idempotencyKey?.trim();

  const currentUser = await getCurrentUser();
  const userId =
    currentUser?.email?.trim().toLowerCase() === payload.customer.email.trim().toLowerCase() ? currentUser.id : null;
  const { admin, products, items } = await getProductsForItems(payload.items);
  if (admin && idempotencyKey) {
    const resumed = await resumeCheckoutByIdempotencyKey(admin, idempotencyKey, provider, payload.paymentFlow);
    if (resumed) return resumed;
  }

  const stockIssues = items.flatMap((item) => {
    const product = products.find((candidate) => matchesItem(candidate, item));
    const available = product?.stock ?? 0;
    if (!product || item.quantity > available) {
      return [{ productId: item.productId, requested: item.quantity, available, name: itemDisplayName(item, product) }];
    }
    return [];
  });

  if (stockIssues.length) throw new InsufficientStockError(stockIssues);

  const lines = items.map((item) => {
    const product = products.find((candidate) => matchesItem(candidate, item));
    if (!product) throw new Error("Un producto del carrito ya no esta disponible.");
    return { product, quantity: item.quantity, subtotal: product.price * item.quantity };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const shippingQuote = payload.shippingMethod === "DELIVERY" ? await quoteDeliveryForAddress(payload.address) : null;
  if (payload.shippingMethod === "DELIVERY" && (!shippingQuote || !shippingQuote.available)) {
    throw new ShippingQuoteError(
      shippingQuote?.reason || "No pudimos cotizar el envio con datos reales. Revisa la direccion o elegi retiro.",
      shippingQuote ?? undefined
    );
  }

  const delivery = shippingQuote?.available ? shippingQuote.amount : 0;
  const total = subtotal + delivery;
  const approvalLimit = purchaseAutoApprovalLimit();
  const requiresAdminApproval = total > approvalLimit;
  const orderStatus = requiresAdminApproval ? "PENDING_ADMIN_APPROVAL" : "PENDING_PAYMENT";
  if (!requiresAdminApproval && provider === "MERCADOPAGO" && !isMercadoPagoEnabled()) {
    throw new MercadoPagoNotConfiguredError();
  }

  if (!admin) {
    throw new Error("Supabase admin no esta configurado para crear ordenes reales.");
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      status: orderStatus,
      customer_name: payload.customer.name,
      customer_email: payload.customer.email,
      customer_phone: payload.customer.phone,
      shipping_method: payload.shippingMethod,
      shipping_cost: delivery,
      subtotal,
      total,
      address_snapshot: shippingQuote?.available ? { ...payload.address, shippingQuote } : payload.address,
      notes: payload.notes ?? null
    })
    .select("id")
    .single();

  if (orderError || !order) throw new Error("No pudimos crear la orden.");

  const orderItems = lines.map(({ product, quantity }) => ({
    order_id: order.id,
    product_id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    quantity,
    image_url: product.image_url
  }));

  await admin.from("order_items").insert(orderItems);

  const { data: payment, error: paymentError } = await admin
    .from("payments")
    .insert({
      order_id: order.id,
      provider,
      status: "PENDING",
      amount: total,
      currency: "ars",
      provider_session_id: idempotencyKey || null
    })
    .select("id")
    .single();

  if (paymentError || !payment) throw new Error("No pudimos registrar el pago pendiente.");

  await notifyAdminNewOrder({ id: order.id, customerName: payload.customer.name, total });

  if (requiresAdminApproval) {
    await notifyAdminLargePurchase({ id: order.id, customerName: payload.customer.name, total, limit: approvalLimit });
    return {
      ...checkoutSuccessResponse({
        orderId: order.id,
        paymentId: payment.id,
        orderStatus,
        requiresAdminApproval: true,
        pending: true,
        total,
        provider,
        message: "Compra creada correctamente. Requiere aprobacion del administrador."
      })
    };
  }

  await notifyAdminPaymentPending({ id: order.id, customerName: payload.customer.name });

  if (provider === "MERCADOPAGO" && payload.paymentFlow === "CARD") {
    if (!isMercadoPagoEnabled()) throw new MercadoPagoNotConfiguredError(order.id);
    return checkoutSuccessResponse({
      orderId: order.id,
      paymentId: payment.id,
      orderStatus,
      requiresAdminApproval: false,
      pending: true,
      card: true,
      total,
      provider
    });
  }

  if (provider === "MERCADOPAGO" && isMercadoPagoEnabled()) {
    const preference = await createMercadoPagoPreference({
      orderId: order.id,
      customer: payload.customer,
      items: lines.map(({ product, quantity }) => ({ product, quantity })),
      shippingCost: delivery,
      total,
      idempotencyKey
    });

    if (!preference?.redirect_url) throw new Error("El proveedor de pago no devolvio una URL valida.");

    await admin
      .from("payments")
      .update({ provider_preference_id: preference.preference_id, updated_at: new Date().toISOString() })
      .eq("order_id", order.id);

    return checkoutSuccessResponse({
      orderId: order.id,
      paymentId: payment.id,
      orderStatus,
      requiresAdminApproval: false,
      preference,
      total,
      provider
    });
  }

  if (provider === "MERCADOPAGO") {
    throw new MercadoPagoNotConfiguredError(order.id);
  }

  return checkoutSuccessResponse({
    orderId: order.id,
    paymentId: payment.id,
    orderStatus,
    requiresAdminApproval: false,
    pending: true,
    total,
    provider
  });
}
