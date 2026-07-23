import "server-only";

import { getEnv, getSiteUrl as readSiteUrl, hasRealValue } from "@/lib/utils/env";

export const MERCADOPAGO_NOT_CONFIGURED_MESSAGE =
  "Mercado Pago no esta configurado para iniciar pagos online.";

type PaymentsEnvironment = "test" | "production";
type MercadoPagoCredentialUse = "checkout" | "card";

export class MercadoPagoNotConfiguredError extends Error {
  code = "MERCADOPAGO_NOT_CONFIGURED";
  orderId?: string;

  constructor(orderId?: string) {
    super(MERCADOPAGO_NOT_CONFIGURED_MESSAGE);
    this.name = "MercadoPagoNotConfiguredError";
    this.orderId = orderId;
  }
}

export function isPaymentsEnabled() {
  return getEnv("PAYMENTS_ENABLED").toLowerCase() === "true" || getEnv("PAYMENT_ENABLED").toLowerCase() === "true";
}

function getPaymentsEnvironment(): PaymentsEnvironment {
  const value = getEnv("PAYMENTS_ENV").toLowerCase();
  return value === "production" ? "production" : "test";
}

export function getPaymentConfig() {
  const accessToken = getEnv("MERCADOPAGO_ACCESS_TOKEN");
  const publicKey = getEnv("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY") || getEnv("MERCADOPAGO_PUBLIC_KEY");
  const cardPaymentsEnabled = getEnv("MERCADOPAGO_CARD_ENABLED").toLowerCase() === "true";
  return {
    accessToken,
    publicKey,
    checkoutProAccessToken: getEnv("MERCADOPAGO_CHECKOUT_PRO_ACCESS_TOKEN") || accessToken,
    checkoutProPublicKey: getEnv("NEXT_PUBLIC_MERCADOPAGO_CHECKOUT_PRO_PUBLIC_KEY") || publicKey,
    cardPaymentsEnabled,
    cardAccessToken: getEnv("MERCADOPAGO_CARD_ACCESS_TOKEN"),
    cardPublicKey: getEnv("NEXT_PUBLIC_MERCADOPAGO_CARD_PUBLIC_KEY"),
    webhookSecret: getEnv("MERCADOPAGO_WEBHOOK_SECRET"),
    siteUrl: readSiteUrl(),
    paymentsEnabled: isPaymentsEnabled(),
    paymentsEnv: getPaymentsEnvironment(),
    provider: getEnv("PAYMENTS_PROVIDER") || "mercadopago"
  };
}

export const getMercadoPagoConfig = getPaymentConfig;
export const getSiteUrl = readSiteUrl;

function accessTokenForUse(use: MercadoPagoCredentialUse) {
  const config = getPaymentConfig();
  return use === "card" ? config.cardAccessToken : config.checkoutProAccessToken;
}

export function isMercadoPagoConfigured(use: MercadoPagoCredentialUse = "checkout") {
  const config = getPaymentConfig();
  if (use === "card" && !config.cardPaymentsEnabled) return false;
  const baseConfigured =
    config.paymentsEnabled &&
    config.provider.toLowerCase() === "mercadopago" &&
    hasRealValue(accessTokenForUse(use)) &&
    hasRealValue(config.siteUrl);
  if (use === "card" && !hasRealValue(config.cardPublicKey)) return false;
  if (!baseConfigured) return false;
  if (config.paymentsEnv === "test") return true;

  try {
    const siteUrl = new URL(config.siteUrl);
    const publicHttps = siteUrl.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(siteUrl.hostname);
    return publicHttps && hasRealValue(config.webhookSecret);
  } catch {
    return false;
  }
}

export function isTestPaymentEnv() {
  return getPaymentConfig().paymentsEnv === "test";
}

export const isMercadoPagoTestMode = isTestPaymentEnv;

export function paymentLiveModeMatchesEnvironment(liveMode: unknown) {
  if (typeof liveMode !== "boolean") return true;
  return getPaymentConfig().paymentsEnv === "production" ? liveMode : !liveMode;
}

export function getMercadoPagoEnvironmentState() {
  const config = getPaymentConfig();
  return {
    paymentsEnv: config.paymentsEnv,
    paymentsEnabled: config.paymentsEnabled,
    isMercadoPagoConfigured: isMercadoPagoConfigured(),
    hasAccessToken: hasRealValue(config.checkoutProAccessToken),
    hasCheckoutProAccessToken: hasRealValue(config.checkoutProAccessToken),
    cardPaymentsEnabled: config.cardPaymentsEnabled,
    hasCardAccessToken: hasRealValue(config.cardAccessToken),
    hasPublicKey: hasRealValue(config.publicKey),
    hasCheckoutProPublicKey: hasRealValue(config.checkoutProPublicKey),
    hasCardPublicKey: hasRealValue(config.cardPublicKey),
    hasWebhookSecret: hasRealValue(config.webhookSecret)
  };
}

export function assertMercadoPagoConfigured(orderId?: string, use: MercadoPagoCredentialUse = "checkout") {
  if (!isMercadoPagoConfigured(use)) throw new MercadoPagoNotConfiguredError(orderId);
  const config = getPaymentConfig();
  return {
    ...config,
    accessToken: accessTokenForUse(use)
  };
}
