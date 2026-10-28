import { expect, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Prueba sin operaciones reales, solo Chromium desktop.");
});

// This suite MUST remain strictly non-mutating: the payloads are blocked
// by validation or by the missing authenticated session before any order
// could be persisted. Do not add real credentials or enabled payment calls.
const unreachableProduct = "00000000-0000-4000-8000-000000000000";
const safeCheckout = {
  customer_name: "Prueba sin sesión",
  customer_email: "checkout-sin-sesion@example.invalid",
  customer_phone: "+5493410000000",
  shipping_method: "PICKUP",
  address_snapshot: {},
  payment_method: "BANK_TRANSFER",
  payment_flow: "TRANSFER",
  accepted_terms: true,
  idempotency_key: "qa-readonly-20261027",
  items: [{ product_id: unreachableProduct, quantity: 1 }]
};

test("el checkout no expone compras a clientes anónimos", async ({ request }) => {
  const response = await request.get("/checkout", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(response.status());
  expect(decodeURIComponent(response.headers().location ?? "")).toMatch(/\/login.*next=.*checkout/i);
});

test("la API de compra bloquea cualquier intento anónimo antes de crear pedidos", async ({ request }) => {
  const response = await request.post("/api/checkout/create", { data: safeCheckout });
  expect(response.status()).toBe(401);
  expect(await response.text()).toMatch(/iniciar sesi[oó]n|cuenta/i);
});

test("WhatsApp no puede confundirse con un medio de pago", async ({ request }) => {
  const response = await request.post("/api/checkout/create", {
    data: { ...safeCheckout, payment_method: "WHATSAPP", payment_flow: "WHATSAPP" }
  });
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({ error: "PAYMENT_METHOD_NOT_ALLOWED" });
});

test("el retorno de pago no permite conciliar pedidos sin sesión", async ({ request }) => {
  const response = await request.post("/api/payments/mercadopago/reconcile", {
    data: { orderId: unreachableProduct, paymentId: "123456" }
  });
  expect(response.status()).toBe(401);
  expect(await response.text()).toMatch(/iniciar sesi[oó]n/i);
});

test("ambos webhooks rechazan JSON e identificadores inválidos antes de registrar eventos", async ({ request }) => {
  for (const endpoint of ["/api/webhooks/mercadopago", "/api/payments/mercadopago/webhook"]) {
    const malformed = await request.post(endpoint, {
      headers: { "Content-Type": "application/json" }, data: "{"
    });
    expect(malformed.status()).toBe(400);
    const invalidId = await request.post(endpoint, { data: { type: "payment", data: { id: "invalid-qa-id" } } });
    expect(invalidId.status()).toBe(400);
    expect(await invalidId.json()).toMatchObject({ ok: false, received: false });
  }
});

test("rechaza los términos no aceptados antes de procesar una compra", async ({ request }) => {
  const response = await request.post("/api/checkout/create", {
    data: { ...safeCheckout, accepted_terms: false }
  });
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
});

test("rechaza entrega a domicilio sin dirección completa", async ({ request }) => {
  const response = await request.post("/api/checkout/create", {
    data: { ...safeCheckout, shipping_method: "DELIVERY", address_snapshot: {} }
  });
  expect(response.status()).toBe(422);
  const payload = await response.json();
  expect(payload.message).toMatch(/calle|direcci[oó]n|n[uú]mero/i);
});

test("rechaza un pedido con carrito vacío", async ({ request }) => {
  const response = await request.post("/api/checkout/create", {
    data: { ...safeCheckout, items: [] }
  });
  expect(response.status()).toBe(422);
  expect(await response.json()).toMatchObject({ error: "VALIDATION_ERROR" });
});

test("la cotización de envíos exige carrito y dirección válidos", async ({ request }) => {
  const baseAddress = { street: "Córdoba", number: "1200", city: "Rosario", province: "Santa Fe" };
  const [emptyCart, badAddress] = await Promise.all([
    request.post("/api/shipping/quote", { data: { ...baseAddress, items: [] } }),
    request.post("/api/shipping/quote", { data: {
      ...baseAddress, street: "A", items: [{ product_id: unreachableProduct, quantity: 1 }]
    } })
  ]);
  expect(emptyCart.status()).toBe(422);
  expect(badAddress.status()).toBe(422);
  expect(JSON.stringify(await emptyCart.json())).not.toMatch(/AIza|API_KEY_/i);
  expect(JSON.stringify(await badAddress.json())).not.toMatch(/AIza|API_KEY_/i);
});

test("robots bloquea indexación en la instancia de pruebas y no publica un sitemap de demo", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toMatch(/Disallow:\s*\/\s*$/m);

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).not.toContain("<url>");
});

test("SEO: la tienda describe la política real de devoluciones y usa URL canónica", async ({ request }) => {
  const home = await request.get("/");
  expect(home.status()).toBe(200);
  const body = await home.text();
  expect(body).toContain("MerchantReturnPolicy");
  expect(body).toContain("Materiales de construcción en Rosario");
  expect(body).toMatch(/materiales de construcción en Rosario/i);
  expect(body).toContain("/cambios-y-devoluciones");
  expect(body).not.toMatch(/<meta[^>]+name=["']robots["'][^>]+content=["']index, follow/i);

  const catalog = await request.get("/productos");
  expect(catalog.status()).toBe(200);
  expect(await catalog.text()).toContain("rel=\"canonical\"");
});
