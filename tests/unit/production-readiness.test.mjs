import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const baseEnv = {
  ...process.env,
  FZAC_PUBLIC_SITE_URL: "https://shop.example.com",
  NEXT_PUBLIC_SITE_URL: "",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  ADMIN_EMAILS: "admin@example.com",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "test-site-key",
  TURNSTILE_SECRET_KEY: "test-secret-key",
  FZAC_LEGAL_NAME: "Fortaleza Construcciones",
  FZAC_CUIT: "30-00000000-0",
  FZAC_LEGAL_ADDRESS: "Rosario, Santa Fe",
  FZAC_CUSTOMER_SERVICE_HOURS: "Lun a Sab 08-17",
  PAYMENTS_ENABLED: "true",
  PAYMENT_ENABLED: "true",
  PAYMENTS_PROVIDER: "mercadopago",
  RESEND_API_KEY: "",
  RESEND_FROM_EMAIL: "",
  SEO_INDEXING_ENABLED: "false",
  FISCAL_INVOICING_ENABLED: "false",
  FISCAL_INVOICING_PROVIDER: "",
  GOOGLE_MAPS_SERVER_KEY: "",
  GOOGLE_MAPS_SERVER_API_KEY: "",
  GOOGLE_DISTANCE_MATRIX_KEY: "",
  FZAC_SHIPPING_BASE_PRICE: "",
  FZAC_SHIPPING_PRICE_PER_KM: ""
};

function runReadiness(overrides = {}) {
  return spawnSync(process.execPath, ["scripts/production-readiness.mjs", "--strict"], {
    cwd: process.cwd(),
    env: { ...baseEnv, ...overrides },
    encoding: "utf8"
  });
}

test("technical storefront release is not blocked by intentionally disabled optional integrations", () => {
  const result = runReadiness({
    PAYMENTS_ENV: "test",
    PAYMENTS_PRODUCTION_CONFIRMED: "false",
    MERCADOPAGO_PRODUCTION_ACCESS_TOKEN: "",
    NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY: "",
    MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET: ""
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /0 bloqueantes/);
  assert.match(result.stdout, /Cobros productivos no activados/);
});

test("production payment mode blocks release when production credentials are missing", () => {
  const result = runReadiness({
    PAYMENTS_ENV: "production",
    PAYMENTS_PRODUCTION_CONFIRMED: "true",
    MERCADOPAGO_PRODUCTION_ACCESS_TOKEN: "",
    NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY: "",
    MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET: ""
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /BLOCKER \[Pagos\]/);
});
