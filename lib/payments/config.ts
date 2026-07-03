import "server-only";

import { getEnv, getSiteUrl, hasRealValue } from "@/lib/utils/env";

export const MERCADOPAGO_NOT_CONFIGURED_MESSAGE = "Mercado Pago todavia no esta configurado.";

export class MercadoPagoNotConfiguredError extends Error {
  orderId?: string;

  constructor(orderId?: string) {
    super(MERCADOPAGO_NOT_CONFIGURED_MESSAGE);
    this.name = "MercadoPagoNotConfiguredError";
    this.orderId = orderId;
  }
}

export function isPaymentsEnabled() {
  return getEnv("PAYMENTS_ENABLED").toLowerCase() === "true";
}

export function getMercadoPagoConfig() {
  return {
    accessToken: getEnv("MERCADOPAGO_ACCESS_TOKEN"),
    publicKey: getEnv("NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY") || getEnv("MERCADOPAGO_PUBLIC_KEY"),
    webhookSecret: getEnv("MERCADOPAGO_WEBHOOK_SECRET"),
    siteUrl: getSiteUrl(),
    paymentsEnabled: isPaymentsEnabled()
  };
}

export function isMercadoPagoConfigured() {
  const config = getMercadoPagoConfig();
  return config.paymentsEnabled && hasRealValue(config.accessToken);
}

export function assertMercadoPagoConfigured(orderId?: string) {
  if (!isMercadoPagoConfigured()) throw new MercadoPagoNotConfiguredError(orderId);
  return getMercadoPagoConfig();
}
