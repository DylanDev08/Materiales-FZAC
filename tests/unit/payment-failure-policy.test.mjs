import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = new URL(
  "../../supabase/migrations/20260924234844_finalize_failed_order_atomic.sql",
  import.meta.url
);
const cardRoutePath = new URL("../../app/api/checkout/card/route.ts", import.meta.url);
const canonicalWebhookPath = new URL("../../app/api/webhooks/mercadopago/route.ts", import.meta.url);
const compatibilityWebhookPath = new URL("../../app/api/payments/mercadopago/webhook/route.ts", import.meta.url);

test("finalize_failed_order es transaccional, bloquea terminales y queda limitada a service_role", async () => {
  const sql = await readFile(migrationPath, "utf8");

  assert.match(sql, /begin;[\s\S]*create or replace function public\.finalize_failed_order[\s\S]*commit;/i);
  assert.match(sql, /from public\.payments[\s\S]*for update;/i);
  assert.match(sql, /from public\.orders[\s\S]*for update;/i);
  assert.match(sql, /v_payment\.status in \('PAID','REFUNDED'\)/i);
  assert.match(sql, /v_order\.status in \('PAID','CONFIRMED','PREPARING','READY_FOR_PICKUP','OUT_FOR_DELIVERY','DELIVERED','COMPLETED'\)/i);
  assert.match(sql, /status = 'RELEASED'[\s\S]*and status = 'ACTIVE'/i);
  assert.match(sql, /revoke all on function public\.finalize_failed_order[\s\S]*from public, anon, authenticated;/i);
  assert.match(sql, /grant execute on function public\.finalize_failed_order[\s\S]*to service_role;/i);
});

test("Card Brick no libera stock ante una respuesta ambigua del proveedor", async () => {
  const route = await readFile(cardRoutePath, "utf8");

  assert.doesNotMatch(route, /CARD_PAYMENT_CREATE_FAILED/);
  assert.match(route, /error\.code === "CARD_PAYMENT_REJECTED"/);
  assert.match(route, /finalizeFailedPayment\(/);
});

test("las dos rutas webhook delegan al mismo handler endurecido", async () => {
  const [canonical, compatibility] = await Promise.all([
    readFile(canonicalWebhookPath, "utf8"),
    readFile(compatibilityWebhookPath, "utf8")
  ]);

  for (const route of [canonical, compatibility]) {
    assert.match(route, /handleMercadoPagoWebhook/);
    assert.doesNotMatch(route, /validateMercadoPagoSignature|finalizePaidOrder|from\("payments"\)/);
  }
});
