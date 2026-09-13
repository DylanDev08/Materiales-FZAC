import { expect, test } from "@playwright/test";

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

test("404 conserva navegación y búsqueda de productos", async ({ page }) => {
  const response = await page.goto("/ruta-que-no-existe-qa", { waitUntil: "domcontentloaded" });

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: /la obra sigue/i })).toBeVisible();
  await page.getByRole("searchbox", { name: /buscar productos/i }).fill("placa");
  await page.getByRole("button", { name: /buscar en el catálogo/i }).click();
  await expect(page).toHaveURL(/\/productos\?search=placa$/);
});

test("catálogo limita el DOM y permite cargar más resultados", async ({ page }) => {
  await page.goto("/productos", { waitUntil: "domcontentloaded" });
  const cards = page.locator(".catalog-product-column > .product-grid .product-card");

  await expect(cards).toHaveCount(24);
  await expect(page.locator(".mobile-menu-trigger")).toBeEnabled();
  await page.getByRole("button", { name: /mostrar más productos/i }).click();
  await expect(cards).toHaveCount(48);
});

test("carrusel de inicio tiene controles y desplaza productos", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const carousel = page.locator(".product-carousel").first();
  const rail = carousel.locator(".product-grid--rail");
  const next = carousel.getByRole("button", { name: /productos siguientes/i });

  await expect(carousel).toBeVisible();
  await expect(next).toBeVisible();
  const initial = await rail.evaluate((element) => element.scrollLeft);
  await next.click();
  await expect.poll(() => rail.evaluate((element) => element.scrollLeft)).toBeGreaterThan(initial);
});

test("galería permite ampliar la foto real y cerrar con Escape", async ({ page }) => {
  await page.goto("/productos", { waitUntil: "domcontentloaded" });
  const href = await page.locator(".product-card__media").first().getAttribute("href");
  expect(href).toMatch(/^\/producto\//);
  await page.goto(href!, { waitUntil: "domcontentloaded" });

  await expect(page.locator(".mobile-menu-trigger")).toBeEnabled();
  await page.getByRole("button", { name: /ampliar foto/i }).click();
  await expect(page.getByRole("dialog", { name: /vista ampliada/i })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: /vista ampliada/i })).toHaveCount(0);
});

test("404 y catálogo no provocan scroll horizontal en 360px", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });

  for (const route of ["/ruta-mobile-inexistente", "/productos"]) {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `overflow horizontal en ${route}`).toBeLessThanOrEqual(1);
  }
});
