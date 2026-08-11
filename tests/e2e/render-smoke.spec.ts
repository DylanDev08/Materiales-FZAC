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
    accepted_terms: true,
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
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "fzac-privacy-consent-v1",
        JSON.stringify({
          version: "2026-08-11",
          decidedAt: new Date().toISOString(),
          necessary: true,
          preferences: false,
          analytics: false,
          marketing: false
        })
      );
    });
  });

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
    test.setTimeout(180_000);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /productos/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /whatsapp|consultar|material/i }).first()).toBeVisible();

    const hrefs = await page.locator("a[href^='/']").evaluateAll((anchors) =>
      Array.from(new Set(anchors.map((anchor) => (anchor as HTMLAnchorElement).getAttribute("href")).filter(Boolean)))
    );

    const internalLinks = hrefs.slice(0, 25) as string[];
    for (let index = 0; index < internalLinks.length; index += 4) {
      const batch = internalLinks.slice(index, index + 4);
      const responses = await Promise.all(
        batch.map(async (href) => ({ href, response: await request.get(href, { maxRedirects: 2 }) }))
      );
      for (const { href, response } of responses) {
        expect(response.status(), `${href} debe existir`).toBeLessThan(400);
      }
    }
  });

  test("producto se agrega al carrito y checkout carga con productos", async ({ page }) => {
    await page.goto("/productos", { waitUntil: "domcontentloaded" });
    const addButton = page.getByRole("button", { name: /agregar/i }).first();
    if ((await addButton.count()) === 0) {
      await expect(page.locator(".empty-state")).toContainText(/no encontramos productos/i);
      test.skip(true, "El catálogo conectado no tiene productos activos para probar el carrito.");
    }
    await expect(addButton).toBeVisible();
    await addButton.click();

    await page.goto("/carrito", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /continuar al checkout/i })).toBeVisible();
    await page.getByRole("link", { name: /continuar al checkout/i }).click();
    if (hasAuthenticatedState) {
      await expect(page).toHaveURL(/\/checkout/);
      await expect(page.locator("body")).toContainText(/comprador|checkout|pago|pedido|total/i);
    } else {
      await expect(page).toHaveURL(/\/login\?next=(%2F|\/)checkout/);
      await expect(page.locator("body")).toContainText(/ingresar|cuenta|google/i);
    }
  });

  test("proteccion al consumidor es visible y no exige registro", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: /bot[oó]n de arrepentimiento/i }).first()).toBeVisible();

    await page.goto("/arrepentimiento", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /bot[oó]n de arrepentimiento/i })).toBeVisible();
    await expect(page.locator("body")).toContainText(/sin registro previo/i);
    await expect(page.getByLabel(/nombre y apellido/i)).toBeVisible();
    await expect(page.getByLabel(/n[uú]mero de pedido/i)).not.toHaveAttribute("required", "");
  });

  test("endpoint de arrepentimiento rechaza formatos y origenes inseguros sin escribir", async ({ request }) => {
    const wrongType = await request.post("/api/consumer/refund-requests", {
      headers: { "content-type": "text/plain" },
      data: "invalid"
    });
    expect(wrongType.status()).toBe(415);

    const crossSite = await request.post("/api/consumer/refund-requests", {
      headers: { origin: "https://example.invalid", "content-type": "application/json" },
      data: { idempotencyKey: crypto.randomUUID() }
    });
    expect(crossSite.status()).toBe(403);

    const oversized = await request.post("/api/consumer/refund-requests", {
      headers: { "content-type": "application/json" },
      data: { padding: "x".repeat(17 * 1024) }
    });
    expect(oversized.status()).toBe(413);
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
        accepted_terms: true,
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
