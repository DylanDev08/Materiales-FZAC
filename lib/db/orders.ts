import "server-only";

import { createHash } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/get-user";
import { checkoutSchema, checkoutStockSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { MercadoPagoNotConfiguredError } from "@/lib/payments/config";
import { createMercadoPagoPreference, getMercadoPagoPreference, isMercadoPagoEnabled } from "@/lib/payments/mercadopago";
import { resolveProductImageUrl } from "@/lib/products/images";
import { quoteDeliveryForAddress, type ShippingQuote } from "@/lib/shipping/quote";
import { getWhatsAppHref } from "@/lib/utils/contact";
import {
  notifyAdminLargePurchase,
  notifyAdminNewOrder,
  notifyAdminPaymentPending,
  notifyAdminTransferPending
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

export class CheckoutAuthRequiredError extends Error {
  status: 401 | 403;

  constructor(message = "Necesitás iniciar sesión para comprar.", status: 401 | 403 = 401) {
    super(message);
    this.name = "CheckoutAuthRequiredError";
    this.status = status;
  }
}

export class CheckoutIdempotencyError extends Error {
  code: "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_CONFLICT";
  status: 409 | 422;

  constructor(
    code: "IDEMPOTENCY_KEY_REQUIRED" | "IDEMPOTENCY_CONFLICT",
    message: string,
    status: 409 | 422 = code === "IDEMPOTENCY_CONFLICT" ? 409 : 422
  ) {
    super(message);
    this.name = "CheckoutIdempotencyError";
    this.code = code;
    this.status = status;
  }
}

export class CheckoutIntegrityError extends Error {
  code: "CHECKOUT_PERSISTENCE_UNAVAILABLE" | "PRICE_CHANGED" | "CHECKOUT_CREATE_FAILED";
  status: 409 | 500 | 503;

  constructor(
    code: "CHECKOUT_PERSISTENCE_UNAVAILABLE" | "PRICE_CHANGED" | "CHECKOUT_CREATE_FAILED",
    message: string,
    status: 409 | 500 | 503
  ) {
    super(message);
    this.name = "CheckoutIntegrityError";
    this.code = code;
    this.status = status;
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

function checkoutFingerprint(payload: CheckoutInput, userId: string, paymentMethod: string) {
  const snapshot = {
    userId,
    email: payload.customer.email.trim().toLowerCase(),
    paymentMethod,
    paymentFlow: payload.paymentFlow ?? null,
    shippingMethod: payload.shippingMethod,
    address: payload.shippingMethod === "DELIVERY" ? payload.address : null,
    items: payload.items
      .map((item) => ({
        productId: item.productId,
        sku: item.sku ?? null,
        slug: item.slug ?? null,
        quantity: item.quantity
      }))
      .sort((left, right) => left.productId.localeCompare(right.productId))
  };

  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
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
  whatsappUrl?: string | null;
}) {
  const paymentMethod =
    input.provider === "BANK_TRANSFER" ? "BANK_TRANSFER" : input.provider === "WHATSAPP" ? "WHATSAPP" : "MERCADOPAGO";
  return {
    ok: true,
    status: 201,
    message: input.message ?? "Compra creada correctamente.",
    orderId: input.orderId,
    order_id: input.orderId,
    paymentId: input.paymentId,
    payment_id: input.paymentId,
    order_status: input.orderStatus,
    payment_method: paymentMethod,
    paymentMethod,
    requires_admin_approval: input.requiresAdminApproval,
    redirect_url: null,
    url: null,
    init_point: null,
    sandbox_init_point: null,
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
    ...(input.whatsappUrl ? { whatsapp_url: input.whatsappUrl, whatsappUrl: input.whatsappUrl } : {}),
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
  userId: string,
  customerEmail: string,
  fingerprint: string,
  paymentMethod?: CheckoutInput["paymentMethod"],
  paymentFlow?: CheckoutInput["paymentFlow"]
) {
  const { data: payment } = await admin
    .from("payments")
    .select("id,order_id,provider,status,amount,provider_preference_id,raw")
    .eq("provider_session_id", idempotencyKey)
    .maybeSingle();

  if (!payment?.order_id) return null;

  const { data: order } = await admin
    .from("orders")
    .select(
      "id,user_id,status,customer_name,customer_email,customer_phone,shipping_cost,total"
    )
    .eq("id", payment.order_id)
    .maybeSingle();

  if (!order) return null;

  const normalizedEmail = customerEmail.trim().toLowerCase();
  const storedRaw = (payment.raw ?? {}) as Record<string, unknown>;
  const storedMethod = String(storedRaw.method ?? storedRaw.provider ?? payment.provider ?? "").toUpperCase();
  const storedFingerprint = String(storedRaw.checkout_fingerprint ?? "");
  const ownsAttempt = String(order.user_id ?? "") === userId && String(order.customer_email ?? "").trim().toLowerCase() === normalizedEmail;
  const sameMethod = !storedMethod || storedMethod === String(paymentMethod ?? provider).toUpperCase();
  const sameCheckout = !storedFingerprint || storedFingerprint === fingerprint;

  if (!ownsAttempt || !sameMethod || !sameCheckout) {
    throw new CheckoutIdempotencyError(
      "IDEMPOTENCY_CONFLICT",
      "Este intento de compra ya pertenece a otro pedido. Actualizá el checkout y volvé a intentarlo."
    );
  }

  if (String(order.status) === "CANCELLED") {
    throw new CheckoutIdempotencyError(
      "IDEMPOTENCY_CONFLICT",
      "El intento anterior fue cancelado. Volvé a seleccionar el medio de pago para generar uno nuevo."
    );
  }

  if (String(order.status) === "PENDING_ADMIN_APPROVAL") {
    const coordinationFlow = paymentMethod === "BANK_TRANSFER" || paymentMethod === "WHATSAPP";
    return checkoutSuccessResponse({
      orderId: order.id,
      paymentId: payment.id,
      orderStatus: String(order.status),
      requiresAdminApproval: true,
      pending: true,
      total: Number(order.total ?? payment.amount ?? 0),
      provider,
      message: coordinationFlow
        ? paymentMethod === "WHATSAPP"
          ? "Pedido generado. Podés coordinar el pago y la entrega con FZAC por WhatsApp."
          : "Pedido generado correctamente. FZAC revisará tu pedido y te enviará los datos para realizar la transferencia."
        : "Compra creada correctamente. Requiere aprobación del administrador."
    });
  }

  if (provider === "BANK_TRANSFER" || provider === "WHATSAPP") {
    return checkoutSuccessResponse({
      orderId: order.id,
      paymentId: payment.id,
      orderStatus: String(order.status),
      requiresAdminApproval: true,
      pending: true,
      total: Number(order.total ?? payment.amount ?? 0),
      provider,
      message:
        provider === "WHATSAPP"
          ? "Pedido generado. Podés coordinar el pago y la entrega con FZAC por WhatsApp."
          : "Pedido generado correctamente. FZAC revisará tu pedido y te enviará los datos para realizar la transferencia.",
      whatsappUrl:
        provider === "WHATSAPP"
          ? getWhatsAppHref(`Hola FZAC, generé un pedido con referencia ${String(order.id).slice(0, 8).toUpperCase()} y quiero coordinar el pago y la entrega.`)
          : null
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
      .select("product_id,sku,name,unit_price,quantity,image_url")
      .eq("order_id", order.id)
      .order("created_at", { ascending: true });

    const items = (orderItems ?? []).map((item) => ({
      product: {
        id: String(item.product_id ?? item.sku ?? item.name),
        name: String(item.name),
        price: Number(item.unit_price ?? 0),
        image_url: String(item.image_url ?? "")
      },
      quantity: Number(item.quantity ?? 1)
    }));

    preference = await createMercadoPagoPreference({
      orderId: order.id,
      paymentId: payment.id,
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

export async function inspectCheckoutStock(input: unknown) {
  const payload = checkoutStockSchema.parse(input);
  const { products, items } = await getProductsForItems(payload.items);
  const requestedByProduct = new Map<string, { product?: Product; quantity: number; fallbackName: string }>();

  for (const item of items) {
    const product = products.find((candidate) => matchesItem(candidate, item));
    const key = product?.id ?? item.productId;
    const current = requestedByProduct.get(key);
    requestedByProduct.set(key, {
      product,
      quantity: (current?.quantity ?? 0) + item.quantity,
      fallbackName: itemDisplayName(item, product)
    });
  }

  const issues = Array.from(requestedByProduct.entries()).flatMap(([productId, requested]) => {
    const available = requested.product?.stock ?? 0;
    return !requested.product || requested.quantity > available
      ? [{ productId, requested: requested.quantity, available, name: requested.fallbackName }]
      : [];
  });

  const requestedItems = Array.from(requestedByProduct.values()).flatMap((requested) =>
    requested.product
      ? [{ product: requested.product, quantity: requested.quantity }]
      : []
  );

  return { ok: issues.length === 0, issues, items: requestedItems };
}

export async function validateCheckoutStock(input: unknown) {
  const result = await inspectCheckoutStock(input);
  if (result.issues.length) throw new InsufficientStockError(result.issues);
  return result;
}

export async function createCheckout(input: unknown) {
  const payload = checkoutSchema.parse(input);
  const paymentMethod = payload.paymentMethod ?? "MERCADOPAGO";
  const provider: PaymentProvider =
    paymentMethod === "BANK_TRANSFER" ? "BANK_TRANSFER" : paymentMethod === "WHATSAPP" ? "WHATSAPP" : "MERCADOPAGO";
  const idempotencyKey = payload.idempotencyKey?.trim();

  if (!idempotencyKey) {
    throw new CheckoutIdempotencyError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "No pudimos identificar este intento de compra. Actualizá el checkout y volvé a intentarlo.",
      422
    );
  }

  const currentUser = await getCurrentUser();
  if (!currentUser?.email) {
    throw new CheckoutAuthRequiredError();
  }
  if (currentUser.email.trim().toLowerCase() !== payload.customer.email.trim().toLowerCase()) {
    throw new CheckoutAuthRequiredError("El email del comprador debe coincidir con la cuenta iniciada.", 403);
  }
  const userId = currentUser.id;
  const fingerprint = checkoutFingerprint(payload, userId, paymentMethod);
  const { admin, products, items } = await getProductsForItems(payload.items);
  if (admin) {
    const resumed = await resumeCheckoutByIdempotencyKey(
      admin,
      idempotencyKey,
      provider,
      userId,
      payload.customer.email,
      fingerprint,
      paymentMethod,
      payload.paymentFlow
    );
    if (resumed) return resumed;
  }

  const linesByProduct = new Map<string, { product: Product; quantity: number; subtotal: number }>();
  for (const item of items) {
    const product = products.find((candidate) => matchesItem(candidate, item));
    if (!product) throw new Error("Un producto del carrito ya no esta disponible.");
    const current = linesByProduct.get(product.id);
    const quantity = (current?.quantity ?? 0) + item.quantity;
    linesByProduct.set(product.id, { product, quantity, subtotal: product.price * quantity });
  }

  const lines = Array.from(linesByProduct.values());
  const stockIssues = lines.flatMap(({ product, quantity }) =>
    quantity > product.stock
      ? [{ productId: product.id, requested: quantity, available: product.stock, name: product.name }]
      : []
  );

  if (stockIssues.length) throw new InsufficientStockError(stockIssues);

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const shippingQuote = payload.shippingMethod === "DELIVERY" ? await quoteDeliveryForAddress(payload.address) : null;
  if (payload.shippingMethod === "DELIVERY" && (!shippingQuote || !shippingQuote.available)) {
    throw new ShippingQuoteError(
      shippingQuote?.reason || "No pudimos cotizar el envío con datos reales. Revisá la dirección o elegí retiro.",
      shippingQuote ?? undefined
    );
  }

  const delivery = shippingQuote?.available ? shippingQuote.amount : 0;
  const total = subtotal + delivery;
  const approvalLimit = purchaseAutoApprovalLimit();
  const isBankTransfer = paymentMethod === "BANK_TRANSFER";
  const isWhatsApp = paymentMethod === "WHATSAPP";
  const isLargePurchase = total > approvalLimit;
  const requiresAdminApproval = isLargePurchase || isBankTransfer || isWhatsApp;
  const orderStatus = isLargePurchase
    ? "PENDING_ADMIN_APPROVAL"
    : isBankTransfer
      ? "PENDING_TRANSFER"
      : isWhatsApp
        ? "COORDINATE"
        : "PENDING_PAYMENT";
  if (paymentMethod === "MERCADOPAGO" && !isLargePurchase && !isMercadoPagoEnabled()) {
    throw new MercadoPagoNotConfiguredError();
  }

  if (!admin) {
    throw new Error("Supabase admin no esta configurado para crear ordenes reales.");
  }

  const paymentRaw = {
    method: paymentMethod,
    provider,
    flow: payload.paymentFlow ?? null,
    requested_order_status: orderStatus,
    checkout_fingerprint: fingerprint
  };
  const atomicItems = lines.map(({ product, quantity }) => ({
    product_id: product.id,
    sku: product.sku,
    name: product.name,
    unit_price: product.price,
    quantity,
    image_url: product.image_url
  }));
  const { data: atomicData, error: atomicError } = await admin.rpc("create_checkout_order", {
    p_user_id: userId,
    p_customer_name: payload.customer.name,
    p_customer_email: payload.customer.email,
    p_customer_phone: payload.customer.phone,
    p_shipping_method: payload.shippingMethod,
    p_shipping_cost: delivery,
    p_subtotal: subtotal,
    p_total: total,
    p_address_snapshot: shippingQuote?.available ? { ...payload.address, shippingQuote } : payload.address,
    p_notes: payload.notes ?? null,
    p_order_status: orderStatus,
    p_payment_provider: provider,
    p_idempotency_key: idempotencyKey,
    p_payment_raw: paymentRaw,
    p_items: atomicItems
  });

  if (atomicError) {
    const detail = `${atomicError.message ?? ""} ${atomicError.details ?? ""}`;
    if (detail.includes("INSUFFICIENT_STOCK")) {
      throw new InsufficientStockError(
        lines.map(({ product, quantity }) => ({
          productId: product.id,
          requested: quantity,
          available: product.stock,
          name: product.name
        }))
      );
    }
    if (detail.includes("PRICE_CHANGED") || detail.includes("INVALID_ITEMS_SUBTOTAL")) {
      throw new CheckoutIntegrityError(
        "PRICE_CHANGED",
        "El precio de un producto cambió mientras revisábamos el pedido. Actualizá el carrito para continuar.",
        409
      );
    }
    if (detail.includes("create_checkout_order") || atomicError.code === "PGRST202") {
      throw new CheckoutIntegrityError(
        "CHECKOUT_PERSISTENCE_UNAVAILABLE",
        "El sistema de pedidos está actualizándose. Probá nuevamente en unos minutos.",
        503
      );
    }
    throw new CheckoutIntegrityError(
      "CHECKOUT_CREATE_FAILED",
      "No pudimos guardar el pedido completo. No se generó ningún cobro.",
      500
    );
  }

  const atomic = (atomicData ?? {}) as {
    created?: boolean;
    order_id?: string;
    payment_id?: string;
  };
  if (!atomic.order_id || !atomic.payment_id) {
    throw new CheckoutIntegrityError(
      "CHECKOUT_CREATE_FAILED",
      "No pudimos confirmar la creación completa del pedido. No se generó ningún cobro.",
      500
    );
  }

  if (!atomic.created) {
    const resumed = await resumeCheckoutByIdempotencyKey(
      admin,
      idempotencyKey,
      provider,
      userId,
      payload.customer.email,
      fingerprint,
      paymentMethod,
      payload.paymentFlow
    );
    if (resumed) return resumed;
    throw new CheckoutIntegrityError(
      "CHECKOUT_CREATE_FAILED",
      "No pudimos recuperar el pedido ya iniciado. Actualizá el checkout para continuar.",
      500
    );
  }

  const order = { id: atomic.order_id };
  const payment = { id: atomic.payment_id };

  await notifyAdminNewOrder({ id: order.id, customerName: payload.customer.name, total });

  if (isBankTransfer || isWhatsApp) {
    await notifyAdminTransferPending({
      id: order.id,
      customerName: payload.customer.name,
      total,
      flow: isWhatsApp ? "WHATSAPP" : "BANK_TRANSFER"
    });
    return {
      ...checkoutSuccessResponse({
        orderId: order.id,
        paymentId: payment.id,
        orderStatus,
        requiresAdminApproval: true,
        pending: true,
        total,
        provider,
        message:
          isWhatsApp
            ? "Pedido generado. Podes coordinar el pago y la entrega con FZAC por WhatsApp."
            : "Pedido generado correctamente. FZAC revisara tu pedido y te enviara los datos para realizar la transferencia.",
        whatsappUrl: isWhatsApp
          ? getWhatsAppHref(`Hola FZAC, genere un pedido con referencia ${String(order.id).slice(0, 8).toUpperCase()} y quiero coordinar el pago y la entrega.`)
          : null
      })
    };
  }

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
      paymentId: payment.id,
      customer: payload.customer,
      items: lines.map(({ product, quantity }) => ({ product, quantity })),
      shippingCost: delivery,
      total,
      idempotencyKey
    });

    if (!preference?.redirect_url) throw new Error("El proveedor de pago no devolvió una URL válida.");

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
