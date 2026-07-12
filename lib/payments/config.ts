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
  return config.paymentsEnabled && hasRealValue(config.accessToken) && hasRealValue(config.siteUrl);
}

export function isTestPaymentEnv() {
  const config = getPaymentConfig();
  return config.paymentsEnv === "test" || config.accessToken.startsWith("TEST-") || config.publicKey.startsWith("TEST-");
}

export const isMercadoPagoTestMode = isTestPaymentEnv;

export function assertMercadoPagoConfigured(orderId?: string) {
  if (!isMercadoPagoConfigured()) throw new MercadoPagoNotConfiguredError(orderId);
  return getPaymentConfig();
}
