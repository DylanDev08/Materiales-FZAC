import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("el preflight expone solo estados y rechaza credenciales no productivas", () => {
  const secretMarker = "do-not-print-this-value";
  const result = spawnSync(process.execPath, ["scripts/mercadopago-production-preflight.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      FZAC_PUBLIC_SITE_URL: "https://www.fzacmateriales.store",
      PAYMENTS_ENABLED: "true",
      PAYMENTS_PROVIDER: "mercadopago",
      PAYMENTS_ENV: "production",
      PAYMENTS_PRODUCTION_CONFIRMED: "false",
      MERCADOPAGO_CARD_ENABLED: "false",
      MERCADOPAGO_PRODUCTION_ACCESS_TOKEN: `TEST-${secretMarker}`,
      NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY: `TEST-${secretMarker}`,
      MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET: secretMarker
    },
    encoding: "utf8"
  });

  assert.notEqual(result.status, 0);
  assert.doesNotMatch(result.stdout, new RegExp(secretMarker));
  const status = JSON.parse(result.stdout.trim());
  assert.equal(status.hasProductionAccessToken, true);
  assert.equal(status.productionAccessTokenFormatValid, false);
  assert.equal(status.credentialsReachable, false);
  assert.equal(status.environmentMatches, false);
  assert.equal(status.productionConfirmed, false);
  assert.equal(status.cardEnabled, false);
  assert.equal(status.createdPayments, false);
});
