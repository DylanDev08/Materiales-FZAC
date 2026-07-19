import "server-only";

import { MercadoPagoConfig, Preference } from "mercadopago";
import {
  assertMercadoPagoConfigured,
  getMercadoPagoEnvironmentState,
  isMercadoPagoConfigured,
  isTestPaymentEnv
} from "@/lib/payments/config";
import type { Product } from "@/types/domain";

type PreferenceInput = {
  orderId: string;
  paymentId?: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  items: Array<{ product: Pick<Product, "id" | "name" | "price" | "image_url">; quantity: number }>;
  shippingCost: number;
  total: number;
  siteUrl?: string;
  idempotencyKey?: string;
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

type RefundInput = {
  providerPaymentId: string;
  idempotencyKey: string;
};

export class MercadoPagoRefundError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number) {
    super("Mercado Pago no pudo procesar el reembolso.");
    this.name = "MercadoPagoRefundError";
    this.code = code;
    this.status = status;
  }
}

function safeUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

function publicWebhookUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function isPublicHttpsUrl(url: URL | null) {
  if (!url || url.protocol !== "https:") return false;
  return !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
}

function safePreferenceLogContext(input: {
  orderId: string;
  paymentId?: string;
  payerEmail?: string;
  itemsCount: number;
  total: number;
  checkoutSiteUrl: URL | null;
  webhookSiteUrl: URL | null;
  preferenceId?: string | null;
  redirectUrl?: string | null;
  initPoint?: string | null;
  sandboxInitPoint?: string | null;
}) {
  return {
    ...getMercadoPagoEnvironmentState(),
    order_id: input.orderId,
    payment_id: input.paymentId ?? null,
    external_reference: input.orderId,
    items_count: input.itemsCount,
    total: input.total,
    has_back_urls: Boolean(input.checkoutSiteUrl),
    has_notification_url: Boolean(input.webhookSiteUrl),
    uses_public_return_url: isPublicHttpsUrl(input.checkoutSiteUrl),
    preference_id: input.preferenceId ?? null,
    redirect_url_exists: Boolean(input.redirectUrl),
    sandbox_init_point_exists: Boolean(input.sandboxInitPoint),
    init_point_exists: Boolean(input.initPoint)
  };
}

function developmentPaymentLog(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown>
) {
  if (process.env.NODE_ENV === "production") return;
  console[level](message, context);
}

function safeMercadoPagoError(error: unknown) {
  const detail = error as {
    message?: unknown;
    status?: unknown;
    statusCode?: unknown;
    cause?: unknown;
  };
  return {
    status: typeof detail.status === "number" ? detail.status : typeof detail.statusCode === "number" ? detail.statusCode : undefined,
    message: typeof detail.message === "string" ? detail.message.slice(0, 220) : "Mercado Pago rechazo la preferencia.",
    cause: Array.isArray(detail.cause) ? detail.cause.slice(0, 3) : undefined
  };
}

function checkoutPictureUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function mercadoPagoPreferenceErrorMessage(detail: string) {
  try {
    const parsed = JSON.parse(detail) as { error?: string; message?: string };
    if (parsed.error === "invalid_auto_return") {
      return "Mercado Pago rechazo el retorno automatico. Ya ajustamos el checkout para operar sin retorno automatico en entorno local.";
    }
    if (parsed.message) return "Mercado Pago rechazo la preferencia. Revisa los datos del checkout e intenta nuevamente.";
  } catch {
    // Keep a generic user-facing message below.
  }

  return "Mercado Pago rechazo la preferencia. Revisa los datos del checkout e intenta nuevamente.";
}

function createMercadoPagoClient(accessToken: string) {
  return new MercadoPagoConfig({ accessToken });
}

function sdkPreferenceErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return mercadoPagoPreferenceErrorMessage(error.message);
  }
  return "Mercado Pago rechazo la preferencia. Revisa los datos del checkout e intenta nuevamente.";
}

export function isMercadoPagoEnabled() {
  return isMercadoPagoConfigured();
}

export async function createMercadoPagoPreference(input: PreferenceInput) {
  const { accessToken, siteUrl } = assertMercadoPagoConfigured(input.orderId);
  const checkoutSiteUrl = safeUrl(input.siteUrl ?? siteUrl);
  const webhookSiteUrl = publicWebhookUrl(input.siteUrl ?? siteUrl);
  const orderQuery = `orderId=${encodeURIComponent(input.orderId)}`;
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

  const redirects = checkoutSiteUrl
    ? {
        back_urls: {
          success: `${checkoutSiteUrl.origin}/checkout/success?${orderQuery}`,
          pending: `${checkoutSiteUrl.origin}/checkout/pending?${orderQuery}`,
          failure: `${checkoutSiteUrl.origin}/checkout/failure?${orderQuery}`
        },
        ...(isPublicHttpsUrl(checkoutSiteUrl) ? { auto_return: "approved" } : {}),
        ...(webhookSiteUrl ? { notification_url: `${webhookSiteUrl.origin}/api/webhooks/mercadopago` } : {})
      }
    : {};

  const preference = new Preference(createMercadoPagoClient(accessToken));
  const createLogContext = safePreferenceLogContext({
    orderId: input.orderId,
    paymentId: input.paymentId,
    payerEmail: input.customer.email,
    itemsCount: items.length,
    total: input.total,
    checkoutSiteUrl,
    webhookSiteUrl
  });
  developmentPaymentLog("info", "[mercadopago.preference.create]", createLogContext);

  const data = (await preference
    .create({
      body: {
        items,
        external_reference: input.orderId,
        payer: {
          name: input.customer.name,
          email: input.customer.email,
          phone: { number: input.customer.phone }
        },
        payment_methods: {
          excluded_payment_methods: [],
          excluded_payment_types: [],
          installments: 12
        },
        ...redirects,
        statement_descriptor: "FZAC",
        metadata: {
          order_id: input.orderId,
          source: "materiales-fzac-next"
        }
      },
      requestOptions: { idempotencyKey: input.idempotencyKey || `fzac-pref-${input.orderId}` }
    })
    .catch((error) => {
      developmentPaymentLog("error", "[mercadopago.preference.error]", {
        ...safePreferenceLogContext({
          orderId: input.orderId,
          paymentId: input.paymentId,
          payerEmail: input.customer.email,
          itemsCount: items.length,
          total: input.total,
          checkoutSiteUrl,
          webhookSiteUrl
        }),
        ...safeMercadoPagoError(error)
      });
      throw new Error(`El proveedor de pago rechazo la preferencia: ${sdkPreferenceErrorMessage(error)}`);
    })) as { id?: string; init_point?: string; sandbox_init_point?: string };
  const testMode = isTestPaymentEnv();
  const redirectUrl = testMode ? data.sandbox_init_point || data.init_point || null : data.init_point || null;
  const createdLogContext = safePreferenceLogContext({
    orderId: input.orderId,
    paymentId: input.paymentId,
    payerEmail: input.customer.email,
    itemsCount: items.length,
    total: input.total,
    checkoutSiteUrl,
    webhookSiteUrl,
    preferenceId: data.id ?? null,
    redirectUrl,
    initPoint: data.init_point ?? null,
    sandboxInitPoint: data.sandbox_init_point ?? null
  });

  if (testMode && !data.sandbox_init_point && data.init_point) {
    developmentPaymentLog("warn", "[mercadopago.preference.test_fallback]", {
      ...createdLogContext,
      message: "PAYMENTS_ENV=test pero Mercado Pago no devolvio sandbox_init_point; se usa init_point como fallback."
    });
  }

  developmentPaymentLog("info", "[mercadopago.preference.created]", createdLogContext);

  return {
    preference_id: data.id ?? "",
    preferenceId: data.id ?? "",
    init_point: data.init_point ?? null,
    initPoint: data.init_point ?? null,
    sandbox_init_point: data.sandbox_init_point ?? null,
    redirect_url: redirectUrl,
    url: redirectUrl
  };
}

export async function getMercadoPagoPreference(preferenceId: string) {
  const { accessToken } = assertMercadoPagoConfigured();
  const preference = new Preference(createMercadoPagoClient(accessToken));
  const data = (await preference.get({ preferenceId }).catch(() => null)) as {
    id?: string;
    init_point?: string;
    sandbox_init_point?: string;
  } | null;
  if (!data) return null;
  const redirectUrl = isTestPaymentEnv() ? data.sandbox_init_point || data.init_point || null : data.init_point || null;

  return {
    preference_id: data.id ?? "",
    preferenceId: data.id ?? "",
    init_point: data.init_point ?? null,
    initPoint: data.init_point ?? null,
    sandbox_init_point: data.sandbox_init_point ?? null,
    redirect_url: redirectUrl,
    url: redirectUrl
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

export async function createMercadoPagoRefund(input: RefundInput) {
  const { accessToken } = assertMercadoPagoConfigured();
  const providerPaymentId = input.providerPaymentId.trim();
  const idempotencyKey = input.idempotencyKey.trim().slice(0, 64);
  if (!providerPaymentId || !idempotencyKey) throw new MercadoPagoRefundError("INVALID_REFUND_REQUEST", 422);

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey
      },
      body: "{}",
      cache: "no-store"
    }
  );

  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const cause = Array.isArray(data.cause) ? (data.cause[0] as Record<string, unknown> | undefined) : undefined;
    const code = String(data.error ?? cause?.code ?? `MP_REFUND_${response.status}`).slice(0, 80);
    throw new MercadoPagoRefundError(code, response.status);
  }

  return {
    id: data.id ? String(data.id) : null,
    paymentId: data.payment_id ? String(data.payment_id) : providerPaymentId,
    status: String(data.status ?? "approved"),
    amount: Number(data.amount ?? 0),
    raw: data
  };
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
