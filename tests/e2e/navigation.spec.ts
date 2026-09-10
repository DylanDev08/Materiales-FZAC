import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("fzac-entry-complete-v1", "true");
    window.localStorage.setItem("fzac-privacy-consent-v1", JSON.stringify({
      version: "2026-08-11",
      decidedAt: new Date().toISOString(),
      necessary: true,
      preferences: false,
      analytics: false,
      marketing: false
    }));
  });
});

test("marca Inicio solamente en la raíz", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".category-nav").getByRole("link", { name: "Inicio" })).toHaveAttribute("aria-current", "page");

  await page.goto("/productos", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".category-nav").getByRole("link", { name: "Inicio" })).not.toHaveAttribute("aria-current", "page");
  await expect(page.locator(".category-nav").getByRole("button", { name: /Productos/ })).toHaveAttribute("aria-current", "page");
});

test("detalle y categoría mantienen Productos activo", async ({ page }) => {
  await page.goto("/producto/placa-drywall-12-5mm", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".category-nav").getByRole("button", { name: /Productos/ })).toHaveAttribute("aria-current", "page");

  await page.goto("/categoria/construccion-en-seco", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".category-nav").getByRole("button", { name: /Productos/ })).toHaveAttribute("aria-current", "page");
});

