import "server-only";

import { getCurrentUser } from "@/lib/auth/get-user";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import { createMercadoPagoPreference, isMercadoPagoEnabled } from "@/lib/payments/mercadopago";
import { resolveProductImageUrl } from "@/lib/products/images";
import { getAdminConsolePath } from "@/lib/utils/env";
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

function shippingCost() {
  return 0;
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
  const currentUser = await getCurrentUser();
  const userId =
    currentUser?.email?.trim().toLowerCase() === payload.customer.email.trim().toLowerCase() ? currentUser.id : null;
  const { admin, products, items } = await getProductsForItems(payload.items);

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
  const delivery = shippingCost();
  const total = subtotal + delivery;
  const provider: PaymentProvider = payload.paymentProvider === "NARANJAX" ? "NARANJAX" : "MERCADOPAGO";

  if (!admin) {
    throw new Error("Supabase admin no esta configurado para crear ordenes reales.");
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: userId,
      status: "PENDING_PAYMENT",
      customer_name: payload.customer.name,
      customer_email: payload.customer.email,
      customer_phone: payload.customer.phone,
      shipping_method: payload.shippingMethod,
      shipping_cost: delivery,
      subtotal,
      total,
      address_snapshot: payload.address ?? null,
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

  await admin.from("payments").insert({
    order_id: order.id,
    provider,
    status: "PENDING",
    amount: total,
    currency: "ars"
  });

  await admin.from("notifications").insert({
    target_role: "ADMIN",
    type: "PAYMENT_PENDING",
    title: "Pago pendiente",
    message: `Nueva orden pendiente de pago por ${payload.customer.name}.`,
    link_to: `${getAdminConsolePath()}/pedidos?order=${order.id}`
  });

  if (provider === "MERCADOPAGO" && isMercadoPagoEnabled()) {
    const preference = await createMercadoPagoPreference({
      orderId: order.id,
      customer: payload.customer,
      items: lines.map(({ product, quantity }) => ({ product, quantity })),
      shippingCost: delivery,
      total
    });

    if (!preference?.url) throw new Error("Mercado Pago no devolvio una URL de pago.");

    await admin
      .from("payments")
      .update({ provider_preference_id: preference.preferenceId, updated_at: new Date().toISOString() })
      .eq("order_id", order.id);

    return {
      orderId: order.id,
      url: preference.url,
      init_point: preference.initPoint,
      sandbox_init_point: preference.sandboxInitPoint,
      preference_id: preference.preferenceId,
      provider
    };
  }

  if (provider === "MERCADOPAGO") {
    throw new MercadoPagoNotConfiguredError(order.id);
  }

  return {
    orderId: order.id,
    pending: true,
    total,
    provider,
    message: "Orden creada. El pago queda pendiente hasta confirmar el proveedor de cobro."
  };
}
