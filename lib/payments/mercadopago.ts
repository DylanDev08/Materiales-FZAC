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

type CardPaymentInput = {
  orderId: string;
  amount: number;
  description: string;
  token: string;
  paymentMethodId: string;
  issuerId?: string;
  installments: number;
  payer: {
    email: string;
    identificationType: string;
    identificationNumber: string;
  };
};

function publicUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function checkoutPictureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function isMercadoPagoEnabled() {
  return isMercadoPagoConfigured();
}

export async function createMercadoPagoPreference(input: PreferenceInput) {
  const { accessToken, siteUrl } = assertMercadoPagoConfigured(input.orderId);
  const publicSiteUrl = publicUrl(siteUrl);
  const orderQuery = `order_id=${encodeURIComponent(input.orderId)}`;
  const items = input.items.map(({ product, quantity }) => ({
    id: product.id,
    title: product.name,
    quantity,
    unit_price: Number(product.price),
    currency_id: "ARS",
    ...(checkoutPictureUrl(product.image_url) ? { picture_url: checkoutPictureUrl(product.image_url) } : {})
  }));

  if (input.shippingCost > 0) {
    items.push({
      id: "shipping",
      title: "Entrega coordinada FZAC",
      quantity: 1,
      unit_price: input.shippingCost,
      currency_id: "ARS"
    });
  }

  const redirects = publicSiteUrl
    ? {
        back_urls: {
          success: `${publicSiteUrl.origin}/pago/aprobado?${orderQuery}`,
          pending: `${publicSiteUrl.origin}/pago/pendiente?${orderQuery}`,
          failure: `${publicSiteUrl.origin}/pago/rechazado?${orderQuery}`
        },
        auto_return: "approved",
        notification_url: `${publicSiteUrl.origin}/api/webhooks/mercadopago`
      }
    : {};

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
      ...redirects,
      statement_descriptor: "FZAC",
      metadata: {
        order_id: input.orderId,
        source: "materiales-fzac-next"
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`El proveedor de pago rechazo la preferencia: ${detail.slice(0, 160)}`);
  }

  const data = (await response.json()) as { id: string; init_point?: string };

  return {
    preferenceId: data.id,
    initPoint: data.init_point ?? null,
    url: data.init_point ?? null
  };
}

export async function getMercadoPagoPayment(paymentId: string) {
  const { accessToken } = assertMercadoPagoConfigured();

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });

  if (!response.ok) throw new Error("No pudimos consultar el pago en el proveedor configurado.");
  return response.json() as Promise<Record<string, unknown>>;
}

export async function createMercadoPagoCardPayment(input: CardPaymentInput) {
  const { accessToken } = assertMercadoPagoConfigured(input.orderId);
  const response = await fetch("https://api.mercadopago.com/v1/payments", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `fzac-card-${input.orderId}`
    },
    body: JSON.stringify({
      transaction_amount: Number(input.amount),
      token: input.token,
      description: input.description,
      installments: input.installments,
      payment_method_id: input.paymentMethodId,
      issuer_id: input.issuerId || undefined,
      external_reference: input.orderId,
      statement_descriptor: "FZAC",
      binary_mode: false,
      payer: {
        email: input.payer.email,
        identification: {
          type: input.payer.identificationType,
          number: input.payer.identificationNumber
        }
      },
      metadata: {
        order_id: input.orderId,
        source: "materiales-fzac-card"
      }
    })
  });

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const detail = typeof data.message === "string" ? data.message : "El proveedor rechazo el pago con tarjeta.";
    throw new Error(detail.slice(0, 180));
  }

  return data;
}
