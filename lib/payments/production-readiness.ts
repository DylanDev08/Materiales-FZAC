export type PaymentProductionReadinessInput = {
  paymentsEnabled: boolean;
  provider: string;
  productionConfirmed: boolean;
  productionAccessToken: string;
  webhookSecret: string;
  siteUrl: string;
  paymentsEnv: "test" | "production";
};

function configured(value: string) {
  const normalized = value.trim();
  return Boolean(normalized) && !/^<.*>$/.test(normalized);
}

export function evaluatePaymentProductionReadiness(input: PaymentProductionReadinessInput) {
  const blockers: string[] = [];

  if (!input.paymentsEnabled) blockers.push("PAYMENTS_ENABLED");
  if (input.provider.toLowerCase() !== "mercadopago") blockers.push("PAYMENTS_PROVIDER");
  if (!input.productionConfirmed) blockers.push("PAYMENTS_PRODUCTION_CONFIRMED");
  if (!configured(input.productionAccessToken)) blockers.push("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN");
  if (!configured(input.webhookSecret)) blockers.push("MERCADOPAGO_WEBHOOK_SECRET");

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
