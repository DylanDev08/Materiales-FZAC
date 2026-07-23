import { expect, test, type Page, type TestInfo } from "@playwright/test";

const hasAuthenticatedState = Boolean(process.env.PLAYWRIGHT_AUTH_STATE);

const publicMobileRoutes = [
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

function skipDesktop(testInfo: TestInfo) {
  test.skip(!testInfo.project.name.startsWith("mobile-"), "Suite enfocada solamente en viewports mobile.");
}

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
    innerWidth: window.innerWidth
  }));

  expect(metrics.scrollWidth, "documentElement no debe generar scroll horizontal").toBeLessThanOrEqual(metrics.innerWidth + 2);
  expect(metrics.bodyScrollWidth, "body no debe generar scroll horizontal").toBeLessThanOrEqual(metrics.innerWidth + 2);
}

async function expectTouchTargets(page: Page, selector: string) {
  const boxes = await page.locator(selector).evaluateAll((nodes) =>
    nodes
      .slice(0, 12)
      .map((node) => {
        const rect = (node as HTMLElement).getBoundingClientRect();
        return { width: rect.width, height: rect.height, text: (node.textContent ?? "").trim().slice(0, 40) };
      })
      .filter((rect) => rect.width > 0 && rect.height > 0)
  );

  for (const box of boxes) {
    expect(box.height, `Target tactil bajo en ${box.text || selector}`).toBeGreaterThanOrEqual(38);
  }
}

async function addFirstAvailableProduct(page: Page) {
  const addButton = page.getByRole("button", { name: /^agregar$/i }).first();
  await expect(addButton).toBeVisible();
  await addButton.click();
  await page.waitForFunction(() => {
    try {
      const raw = window.localStorage.getItem("fzac-cart-v1");
      const items = raw ? JSON.parse(raw) : [];
      return Array.isArray(items) && items.length > 0;
    } catch {
      return false;
    }
  });
}

test.describe("Mobile UI audit", () => {
  for (const route of publicMobileRoutes) {
    test(`${route} carga sin overflow horizontal`, async ({ page }, testInfo) => {
      skipDesktop(testInfo);
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      expect(response?.status(), `${route} debe cargar en mobile`).toBeLessThan(400);
      if (route === "/checkout" && !hasAuthenticatedState) {
        await expect(page).toHaveURL(/\/login\?next=(%2F|\/)checkout/);
      }
      await expect(page.locator("body")).not.toBeEmpty();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("menu mobile abre, scrollea, navega y cierra", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const trigger = page.getByRole("button", { name: /menu/i });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const panel = page.locator(".mobile-nav-panel");
    await expect(panel).toBeVisible();
    await expectTouchTargets(page, ".mobile-nav-panel a, .mobile-nav-panel button");
    await panel.getByRole("link", { name: /^productos$/i }).click();
    await expect(page).toHaveURL(/\/productos/);
    await expect(panel).toBeHidden();
  });

  test("catalogo mobile permite escanear y agregar producto", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.goto("/productos", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
    await expect(page.locator(".product-card").first()).toBeVisible();
    await expectTouchTargets(page, ".product-card__actions button, .product-card__actions a");
    await addFirstAvailableProduct(page);
    await expect(page.locator("body")).toContainText(/producto|carrito|agregado/i);
  });

  test("detalle de producto mobile conserva acciones principales", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.goto("/productos", { waitUntil: "domcontentloaded" });
    const productHref = await page.locator("a[href^='/producto/']").first().getAttribute("href");
    expect(productHref).toBeTruthy();

    await page.goto(productHref!, { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByRole("button", { name: /agregar/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /comprar/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /whatsapp|consultar/i }).first()).toBeVisible();
  });

  test("carrito mobile modifica cantidad y llega al checkout", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.goto("/productos", { waitUntil: "domcontentloaded" });
    await addFirstAvailableProduct(page);
    await page.goto("/carrito", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, ".quantity-control button, .cart-remove, .cart-summary-actions a, .cart-summary-actions button");
    await page.getByRole("link", { name: /continuar al checkout/i }).click();
    await expect(page).toHaveURL(hasAuthenticatedState ? /\/checkout/ : /\/login\?next=(%2F|\/)checkout/);
  });

  test("checkout mobile muestra pasos, metodos y no exige direccion en retiro", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    test.skip(!hasAuthenticatedState, "El formulario de checkout requiere PLAYWRIGHT_AUTH_STATE porque comprar exige una cuenta registrada.");
    await page.goto("/productos", { waitUntil: "domcontentloaded" });
    await addFirstAvailableProduct(page);
    await page.goto("/checkout", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);

    await page.getByLabel(/nombre/i).fill("QA Mobile FZAC");
    await page.getByLabel(/email/i).fill(`qa.mobile.${Date.now()}@example.com`);
    await page.getByLabel(/telefono|teléfono/i).fill("+5493410000000");
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await expect(page.locator("body")).toContainText(/retiro/i);
    await page.getByRole("button", { name: /^continuar$/i }).click();
    await expect(page.locator("body")).toContainText(/revisi|stock|pedido/i);
  });

  test("login y registro mobile tienen inputs grandes y Google redirect flow", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.goto("/login?next=/checkout", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
    await expectTouchTargets(page, ".auth-panel input, .auth-panel button, .auth-panel a");
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();

    await page.goto("/registro", { waitUntil: "domcontentloaded" });
    await expectNoHorizontalOverflow(page);
    await expect(page.getByLabel(/nombre/i)).toBeVisible();
    await expect(page.getByLabel(/confirmar/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
  });

  test("admin anonimo queda bloqueado en mobile", async ({ page }, testInfo) => {
    skipDesktop(testInfo);
    await page.goto("/admin", { waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/admin(\/|$)/);
    await expectNoHorizontalOverflow(page);
  });
});
