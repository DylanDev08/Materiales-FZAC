import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Mercado Pago falla cerrado ante ambiente desconocido", async () => {
  const text = await source("../../lib/payments/config.ts");
  assert.match(text, /typeof liveMode !== "boolean"\) return false/);
});

test("Checkout Pro en test exige sandbox_init_point y no cae a init_point", async () => {
  const text = await source("../../lib/payments/mercadopago.ts");
  assert.match(text, /isTestPaymentEnv\(\) \? data\.sandbox_init_point \|\| null : data\.init_point \|\| null/);
  assert.doesNotMatch(text, /sandbox_init_point \|\| data\.init_point/);
});

test("reembolsos Mercado Pago tienen timeout e idempotencia", async () => {
  const text = await source("../../lib/payments/mercadopago.ts");
  assert.match(text, /X-Idempotency-Key/);
  assert.match(text, /AbortController/);
  assert.match(text, /signal: controller\.signal/);
});

test("webhooks sin secret se rechazan en runtimes desplegados", async () => {
  const text = await source("../../lib/payments/mercadopago-webhook.ts");
  assert.match(text, /process\.env\.NODE_ENV === "production"/);
  assert.match(text, /Webhook rechazado porque falta configurar la firma secreta/);
});

test("checkout limita por usuario autenticado y el endpoint legacy reutiliza el handler canonico", async () => {
  const canonical = await source("../../app/api/checkout/create/route.ts");
  const legacy = await source("../../app/api/checkout/route.ts");
  assert.match(canonical, /const currentUser = await getCurrentUser\(\)/);
  assert.match(canonical, /distributedRateLimitIdentity\("checkout-purchase", currentUser\.id/);
  assert.match(canonical, /email del comprador debe coincidir con la cuenta iniciada/);
  assert.match(legacy, /export \{ POST \} from "\.\/create\/route"/);
});

test("pago con tarjeta evita reintentos ciegos tras cobro aprobado pendiente de conciliacion", async () => {
  const text = await source("../../app/api/checkout/card/route.ts");
  assert.match(text, /const identity = currentUser\.id/);
  assert.match(text, /reconciliationRequired: true/);
  assert.match(text, /No vuelvas a pagarlo/);
  assert.match(text, /providerPaymentId/);
});

test("emails de accion solo permiten HTTPS fuera del desarrollo local", async () => {
  const text = await source("../../lib/email/templates.ts");
  assert.match(text, /url\.protocol === "https:"/);
  assert.match(text, /localhost/);
  assert.match(text, /throw new Error\("Enlace de autenticacion invalido\."\)/);
});


test("checkout de tarjeta rechaza campos no tokenizados", async () => {
  const text = await source("../../lib/validations/checkout.ts");
  assert.match(text, /strict\("No envíes datos de tarjeta sin tokenizar\."\)/);
  assert.match(text, /strict\("La solicitud contiene campos no permitidos\."\)/);
});

test("reembolso valida moneda y relee el estado del proveedor antes de finalizar localmente", async () => {
  const text = await source("../../app/api/admin/payments/[id]/refund/route.ts");
  assert.match(text, /amount,currency,provider_payment_id/);
  assert.match(text, /providerCurrency/);
  assert.match(text, /providerCurrency !== localCurrency/);
  assert.match(text, /providerPayment = await getMercadoPagoPayment/);
  assert.match(text, /REFUND_PENDING_PROVIDER_RECONCILIATION/);
});


test("Checkout Pro no devuelve éxito sin una URL segura del entorno", async () => {
  const text = await source("../../lib/payments/mercadopago.ts");
  assert.match(text, /if \(!redirectUrl\)/);
  assert.match(text, /URL sandbox valida/);
  assert.match(text, /if \(!redirectUrl\) return null/);
});

test("webhook toma el identificador del recurso de pago y no el id del evento", async () => {
  const text = await source("../../lib/payments/mercadopago-webhook.ts");
  assert.match(text, /String\(data\?\.id \?\? ""\)/);
  assert.doesNotMatch(text, /String\(body\.id \?\? ""\)/);
});
