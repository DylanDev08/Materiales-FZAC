import { expect, test, type APIRequestContext, type Page, type TestInfo } from "@playwright/test";

const baseUrl = process.env.BASE_URL || "https://materiales-fzac-8xmp.onrender.com";
const qaProductId = process.env.QA_CHECKOUT_PRODUCT_ID || "";
const qaCustomerEmail = process.env.QA_CHECKOUT_EMAIL || "";
const mutatingCheckoutEnabled = process.env.RUN_MUTATING_CHECKOUT_TESTS === "true";
const hasAuthenticatedState = Boolean(process.env.PLAYWRIGHT_AUTH_STATE);
const isLocalTarget = ["localhost", "127.0.0.1"].includes(new URL(baseUrl).hostname);
const remoteWritesAllowed = process.env.QA_ALLOW_REMOTE_WRITES === "true";
const canRunMutatingCheckout =
  mutatingCheckoutEnabled &&
  hasAuthenticatedState &&
  Boolean(qaProductId) &&
  Boolean(qaCustomerEmail) &&
  (isLocalTarget || remoteWritesAllowed);

const publicRoutes = [
  "/",
  "/productos",
  "/carrito",
  "/checkout",
  "/login",
  "/register",
  "/registro",
  "/terminos",
  "/privacidad",
  "/arrepentimiento",
  "/admin"
];

async function expectNoCriticalConsole(page: Page) {
  const critical: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") critical.push(message.text());
  });
  page.on("pageerror", (error) => critical.push(error.message));
  return critical;
}

function checkoutPayload(method: "MERCADOPAGO" | "BANK_TRANSFER" | "WHATSAPP", idempotencyKey: string) {
  return {
    customer_name: `QA ${method}`,
    customer_email: qaCustomerEmail,
    customer_phone: "+5493410000000",
    shipping_method: "PICKUP",
    address_snapshot: {},
    notes: "QA automatizado FZAC. No preparar mercaderia.",
    payment_method: method,
    payment_flow: method === "MERCADOPAGO" ? "CHECKOUT_PRO" : method === "BANK_TRANSFER" ? "TRANSFER" : "WHATSAPP",
    idempotency_key: idempotencyKey,
    items: [{ product_id: qaProductId, quantity: 1 }]
  };
}

async function createCheckout(request: APIRequestContext, method: "MERCADOPAGO" | "BANK_TRANSFER" | "WHATSAPP", key: string) {
  return request.post("/api/checkout/create", {
    data: checkoutPayload(method, key)
  });
}

test.describe("Render public smoke", () => {
  for (const route of publicRoutes) {
    test(`carga ruta publica ${route}`, async ({ page }) => {
      const critical = await expectNoCriticalConsole(page);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${route} no debe responder 404/500`).toBeLessThan(400);
      await expect(page.locator("body")).not.toBeEmpty();
      expect(critical, `Errores criticos en consola para ${route}`).toEqual([]);
    });
  }

  test("header, footer y links internos principales no rompen", async ({ page, request }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /productos/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /whatsapp|consultar|material/i }).first()).toBeVisible();

    const hrefs = await page.locator("a[href^='/']").evaluateAll((anchors) =>
      Array.from(new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href")).filter(Boolean)))
    );

    for (const href of hrefs.slice(0, 25)) {
      const response = await request.get(href as string, { maxRedirects: 2 });
      expect(response.status(), `${href} debe existir`).toBeLessThan(400);
    }
  });

  test("producto se agrega al carrito y checkout carga con productos", async ({ page }) => {
    await page.goto("/productos", { waitUntil: "domcontentloaded" });
    const addButton = page.getByRole("button", { name: /agregar/i }).first();
    await expect(addButton).toBeVisible();
    await addButton.click();

    await page.goto("/carrito", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /continuar al checkout/i })).toBeVisible();
    await page.getByRole("link", { name: /continuar al checkout/i }).click();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(page.locator("body")).toContainText(/comprador|checkout|pago|pedido|total/i);
  });

  test("admin anonimo no expone datos", async ({ page }) => {
    const response = await page.goto("/admin", { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
    await expect(page).not.toHaveURL(/\/admin(\/|$)/);
  });

  test("checkout API rechaza creacion anonima sin escribir datos", async ({ request }) => {
    const response = await request.post("/api/checkout/create", {
      data: {
        customer_name: "QA anonimo",
        customer_email: "qa-anonimo@example.com",
        customer_phone: "+5493410000000",
        shipping_method: "PICKUP",
        address_snapshot: {},
        payment_method: "BANK_TRANSFER",
        payment_flow: "TRANSFER",
        idempotency_key: `qa-unauthorized-${Date.now()}`,
        items: [{ product_id: "00000000-0000-4000-8000-000000000000", quantity: 1 }]
      }
    });

    expect(response.status()).toBe(401);
  });
});

test.describe("Checkout API autenticado y con escritura explicita", () => {
  test.beforeEach(async ({}, testInfo: TestInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Las pruebas API corren una sola vez para no disparar rate limits.");
    test.skip(
      !canRunMutatingCheckout,
      "Requiere RUN_MUTATING_CHECKOUT_TESTS=true, PLAYWRIGHT_AUTH_STATE, QA_CHECKOUT_EMAIL y QA_CHECKOUT_PRODUCT_ID. Los destinos remotos tambien requieren QA_ALLOW_REMOTE_WRITES=true."
    );
  });

  test("idempotencia devuelve la misma orden para la misma key", async ({ request }) => {
    const key = `qa-idempotency-${Date.now()}`;
    const first = await createCheckout(request, "BANK_TRANSFER", key);
    const second = await createCheckout(request, "BANK_TRANSFER", key);

    expect(first.status()).toBe(201);
    expect(second.status()).toBe(201);

    const firstBody = await first.json();
    const secondBody = await second.json();
    expect(secondBody.order_id).toBe(firstBody.order_id);
    expect(secondBody.payment_id).toBe(firstBody.payment_id);
    expect(firstBody.redirect_url).toBeNull();
  });

  test("keys distintas crean ordenes distintas", async ({ request }) => {
    const first = await createCheckout(request, "BANK_TRANSFER", `qa-distinct-a-${Date.now()}`);
    const second = await createCheckout(request, "BANK_TRANSFER", `qa-distinct-b-${Date.now()}`);

    expect(first.status()).toBe(201);
    expect(second.status()).toBe(201);
    expect((await first.json()).order_id).not.toBe((await second.json()).order_id);
  });

  test("transferencia y whatsapp no devuelven redirect de Mercado Pago", async ({ request }) => {
    const transfer = await createCheckout(request, "BANK_TRANSFER", `qa-transfer-${Date.now()}`);
    const whatsapp = await createCheckout(request, "WHATSAPP", `qa-whatsapp-${Date.now()}`);

    expect(transfer.status()).toBe(201);
    expect(whatsapp.status()).toBe(201);

    const transferBody = await transfer.json();
    const whatsappBody = await whatsapp.json();
    expect(transferBody.payment_method).toBe("BANK_TRANSFER");
    expect(transferBody.redirect_url).toBeNull();
    expect(whatsappBody.payment_method).toBe("WHATSAPP");
    expect(whatsappBody.redirect_url).toBeNull();
    expect(whatsappBody.whatsapp_url).toMatch(/^https:\/\/wa\.me\//);
  });

  test("Mercado Pago genera link sandbox en test", async ({ request }) => {
    const response = await createCheckout(request, "MERCADOPAGO", `qa-mp-${Date.now()}`);
    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.payment_method).toBe("MERCADOPAGO");
    expect(body.redirect_url).toContain("mercadopago");
    expect(Boolean(body.sandbox_init_point)).toBeTruthy();
  });
});
