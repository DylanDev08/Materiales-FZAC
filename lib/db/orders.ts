import "server-only";

import crypto from "node:crypto";
import { checkoutSchema, type CheckoutInput } from "@/lib/validations/checkout";
import { fallbackProducts } from "@/lib/db/fallback-data";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createMercadoPagoPreference, isMercadoPagoEnabled } from "@/lib/payments/mercadopago";
import { confirmApprovedPayment } from "@/lib/payments/payment-service";
import type { PaymentProvider, Product } from "@/types/domain";

function shippingCost(input: CheckoutInput) {
  if (input.shippingMethod !== "DELIVERY") return 0;
  if (input.address?.deliveryAvailable === false) return 0;
  return 6500;
}

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
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
}

export async function createCheckout(input: unknown) {
  const payload = checkoutSchema.parse(input);
  const admin = getSupabaseAdminClient();

  const requestedIds = payload.items.map((item) => item.productId);
  let products: Product[] = [];

  if (admin) {
    const { data, error } = await admin
      .from("products")
      .select("*")
      .in("id", requestedIds)
      .eq("active", true);

    if (error) throw new Error("No pudimos validar los productos.");
    products = (data ?? []).map(normalizeProduct);
  } else {
    products = fallbackProducts.filter((product) => requestedIds.includes(product.id));
  }

  const lines = payload.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new Error("Un producto del carrito ya no esta disponible.");
    if (product.stock < item.quantity) throw new Error(`Stock insuficiente para ${product.name}.`);
    return { product, quantity: item.quantity, subtotal: product.price * item.quantity };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.subtotal, 0);
  const delivery = shippingCost(payload);
  const total = subtotal + delivery;
  const provider: PaymentProvider = payload.paymentProvider === "NARANJAX" ? "NARANJAX" : "MERCADOPAGO";

  if (!admin) {
    return {
      mock: true,
      orderId: crypto.randomUUID(),
      total,
      message: "Checkout listo en modo local. Configura Supabase para persistir ordenes."
    };
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .insert({
      user_id: null,
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
    link_to: `/admin/pedidos?order=${order.id}`
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

    return { orderId: order.id, url: preference.url, provider };
  }

  return {
    mock: true,
    orderId: order.id,
    total,
    provider: "MOCK",
    message: "Mercado Pago no esta configurado. Se habilito simulacion controlada."
  };
}

export async function simulatePayment(orderId: string, status: "PAID" | "PENDING" | "FAILED") {
  const admin = getSupabaseAdminClient();

  if (!admin) {
    return {
      orderId,
      status,
      ticketNumber: status === "PAID" ? `FZAC-LOCAL-${Date.now()}` : null
    };
  }

  if (status === "PAID") {
    return confirmApprovedPayment({
      orderId,
      provider: "MOCK",
      providerPaymentId: `mock_${Date.now()}`,
      raw: { status: "approved", amount: null }
    });
  }

  await admin
    .from("payments")
    .update({ status: status === "FAILED" ? "FAILED" : "PENDING", raw: { simulated: true, status } })
    .eq("order_id", orderId);

  await admin
    .from("orders")
    .update({ status: status === "FAILED" ? "CANCELLED" : "PENDING_PAYMENT" })
    .eq("id", orderId);

  return { orderId, status };
}
