export type PaymentProductionReadinessInput = {
  paymentsEnabled: boolean;
  provider: string;
  productionConfirmed: boolean;
  productionAccessToken: string;
  productionPublicKey: string;
  webhookSecret: string;
  siteUrl: string;
  paymentsEnv: "test" | "production";
};

const PLACEHOLDER_PATTERN = /(?:placeholder|changeme|change_me|replace_me|example|your[_-]|x{4,})/i;

function configured(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && !/^<.*>$/.test(normalized) && !PLACEHOLDER_PATTERN.test(normalized);
}

function productionMercadoPagoCredential(value: string) {
  const normalized = value.trim();
  return configured(normalized) && /^APP_USR-[A-Za-z0-9_-]{20,}$/.test(normalized);
}

export function evaluatePaymentProductionReadiness(input: PaymentProductionReadinessInput) {
  const blockers: string[] = [];

  if (!input.paymentsEnabled) blockers.push("PAYMENTS_ENABLED");
  if (input.provider.toLowerCase() !== "mercadopago") blockers.push("PAYMENTS_PROVIDER");
  if (!input.productionConfirmed) blockers.push("PAYMENTS_PRODUCTION_CONFIRMED");
  if (!productionMercadoPagoCredential(input.productionAccessToken)) blockers.push("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN");
  if (!productionMercadoPagoCredential(input.productionPublicKey)) blockers.push("NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY");
  if (!configured(input.webhookSecret)) blockers.push("MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET");

  try {
    const siteUrl = new URL(input.siteUrl);
    if (
      siteUrl.protocol !== "https:" ||
      ["localhost", "127.0.0.1", "0.0.0.0"].includes(siteUrl.hostname)
    ) {
      blockers.push("NEXT_PUBLIC_SITE_URL");
    }
  } catch {
    blockers.push("NEXT_PUBLIC_SITE_URL");
  }

  return {
    ready: blockers.length === 0,
    active: input.paymentsEnv === "production" && blockers.length === 0,
    blockers
  };
}
