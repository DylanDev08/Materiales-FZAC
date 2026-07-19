import "server-only";

import { getEnv, getSiteUrl as readSiteUrl, hasRealValue } from "@/lib/utils/env";

export const MERCADOPAGO_NOT_CONFIGURED_MESSAGE =
  "Mercado Pago no esta configurado para iniciar pagos online.";

type PaymentsEnvironment = "test" | "production";

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
  return {
    accessToken: getEnv("MERCADOPAGO_ACCESS_TOKEN"),
    publicKey: getEnv("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY") || getEnv("MERCADOPAGO_PUBLIC_KEY"),
    webhookSecret: getEnv("MERCADOPAGO_WEBHOOK_SECRET"),
    siteUrl: readSiteUrl(),
    paymentsEnabled: isPaymentsEnabled(),
    paymentsEnv: getPaymentsEnvironment(),
    provider: getEnv("PAYMENTS_PROVIDER") || "mercadopago"
  };
}

export const getMercadoPagoConfig = getPaymentConfig;
export const getSiteUrl = readSiteUrl;

export function isMercadoPagoConfigured() {
  const config = getPaymentConfig();
  const baseConfigured =
    config.paymentsEnabled &&
    config.provider.toLowerCase() === "mercadopago" &&
    hasRealValue(config.accessToken) &&
    hasRealValue(config.siteUrl);
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
    hasAccessToken: hasRealValue(config.accessToken),
    hasPublicKey: hasRealValue(config.publicKey),
    hasWebhookSecret: hasRealValue(config.webhookSecret)
  };
}

export function assertMercadoPagoConfigured(orderId?: string) {
  if (!isMercadoPagoConfigured()) throw new MercadoPagoNotConfiguredError(orderId);
  return getPaymentConfig();
}
