import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("checkout conserva el botón de Mercado Pago conectado al checkout server-side", async () => {
  const checkout = await source("../../components/checkout/checkout-form.tsx");
  const route = await source("../../app/api/checkout/create/route.ts");

  assert.match(checkout, /Pagar con Mercado Pago/);
  assert.match(checkout, /startMercadoPagoPayment/);
  assert.match(checkout, /\/api\/checkout\/create/);
  assert.match(route, /getCurrentUser/);
  assert.match(route, /createCheckout\(payload\)/);
  assert.match(route, /customer\.email/);
});

test("panel de pagos conserva el botón de reembolso solo para Mercado Pago pagado", async () => {
  const table = await source("../../components/admin/admin-interactive-table.tsx");
  const action = await source("../../components/admin/admin-refund-action.tsx");

  assert.match(table, /AdminRefundAction/);
  assert.match(action, /provider !== "MERCADOPAGO"/);
  assert.match(action, /status !== "PAID"/);
  assert.match(action, /\/api\/admin\/payments\/\$\{paymentId\}\/refund/);
  assert.match(action, /REFUND_RECONCILIATION_REQUIRED/);
});

test("reembolso valida administrador MFA, monto, moneda, pedido y ambiente antes de devolver", async () => {
  const route = await source("../../app/api/admin/payments/[id]/refund/route.ts");

  assert.match(route, /getApiAdmin\(\)/);
  assert.match(route, /externalReference !== String\(order\.id\)/);
  assert.match(route, /Math\.abs\(providerAmount - Number\(payment\.amount\)\) > 0\.01/);
  assert.match(route, /providerCurrency !== localCurrency/);
  assert.match(route, /paymentLiveModeMatchesEnvironment/);
  assert.match(route, /fzac-refund-\$\{payment\.id\}/);
});
