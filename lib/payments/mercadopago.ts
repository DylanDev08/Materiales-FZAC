import "server-only";

import { assertMercadoPagoConfigured, isMercadoPagoConfigured } from "@/lib/payments/config";
import type { Product } from "@/types/domain";

type PreferenceInput = {
  orderId: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{ product: Product; quantity: number }>;
  shippingCost: number;
  total: number;
};

export function isMercadoPagoEnabled() {
  return isMercadoPagoConfigured();
}

export async function createMercadoPagoPreference(input: PreferenceInput) {
  const { accessToken, siteUrl } = assertMercadoPagoConfigured(input.orderId);
  const items = input.items.map(({ product, quantity }) => ({
    id: product.id,
    title: product.name,
    quantity,
    unit_price: Number(product.price),
    currency_id: "ARS",
    picture_url: product.image_url
  }));

  if (input.shippingCost > 0) {
    items.push({
      id: "shipping",
      title: "Entrega coordinada FZAC",
      quantity: 1,
      unit_price: input.shippingCost,
      currency_id: "ARS",
      picture_url: ""
    });
  }

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      items,
      external_reference: input.orderId,
      payer: {
        name: input.customer.name,
        email: input.customer.email,
        phone: { number: input.customer.phone }
      },
      back_urls: {
        success: `${siteUrl}/pago/aprobado`,
        pending: `${siteUrl}/pago/pendiente`,
        failure: `${siteUrl}/pago/rechazado`
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/api/webhooks/mercadopago`,
      metadata: {
        order_id: input.orderId,
        source: "materiales-fzac-next"
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Mercado Pago rechazo la preferencia: ${detail.slice(0, 160)}`);
  }

  const data = (await response.json()) as { id: string; init_point?: string; sandbox_init_point?: string };

  return {
    preferenceId: data.id,
    initPoint: data.init_point ?? null,
    sandboxInitPoint: data.sandbox_init_point ?? null,
    url: data.init_point || data.sandbox_init_point || null
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const { accessToken } = assertMercadoPagoConfigured();

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  if (!response.ok) throw new Error("No pudimos consultar el pago en Mercado Pago.");
  return response.json() as Promise<Record<string, unknown>>;
}
