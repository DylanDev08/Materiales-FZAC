import { expect, test } from "@playwright/test";

test.describe("Privacidad y descubrimiento", () => {
  test.beforeEach(async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => window.localStorage.clear());
  });

  test("consentimiento es informado, configurable y reversible", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const consent = page.getByLabel("Preferencias de privacidad");
    await expect(consent).toBeVisible();
    await expect(consent).toContainText(/no usamos publicidad ni vendemos tus datos/i);
    await consent.getByRole("button", { name: "Configurar" }).click();

    const preferences = consent.getByRole("checkbox");
    await preferences.check();
    await consent.getByRole("button", { name: "Guardar preferencias" }).click();
    await expect(consent).toBeHidden();

    const accepted = await page.evaluate(() => JSON.parse(window.localStorage.getItem("fzac-privacy-consent-v1") || "null"));
    expect(accepted.preferences).toBe(true);
    expect((await page.context().cookies()).some((cookie) => cookie.name === "fzac_privacy_consent")).toBe(true);

    await page.evaluate(() => window.localStorage.setItem("fzac-search-recent-v1", JSON.stringify(["cemento"])));
    await page.getByRole("button", { name: "Preferencias de cookies" }).click();
    await consent.getByRole("button", { name: "Solo necesarias" }).click();

    const rejected = await page.evaluate(() => ({
      consent: JSON.parse(window.localStorage.getItem("fzac-privacy-consent-v1") || "null"),
      recent: window.localStorage.getItem("fzac-search-recent-v1")
    }));
    expect(rejected.consent.preferences).toBe(false);
    expect(rejected.recent).toBeNull();
  });

  test("páginas comerciales publican canonical y tarjetas sociales", async ({ page }) => {
    await page.goto("/productos", { waitUntil: "domcontentloaded" });

    await expect(page.locator("link[rel='canonical']")).toHaveAttribute("href", /\/productos$/);
    await expect(page.locator("meta[property='og:title']")).toHaveAttribute("content", /Materiales FZAC/);
    await expect(page.locator("meta[property='og:image']")).toHaveAttribute("content", /fzac-storefront-hero\.webp/);
    await expect(page.locator("meta[name='twitter:card']")).toHaveAttribute("content", "summary_large_image");
  });

  test("registro con Google exige aceptación legal explícita", async ({ page }) => {
    await page.goto("/register", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Solo necesarias" }).click();

    const legalConsent = page.getByText(/acepto.*términos.*privacidad/i).first();
    await expect(legalConsent).toBeVisible();
    await page.getByRole("button", { name: /continuar con Google/i }).click();

    await expect(page).toHaveURL(/\/(register|registro)/);
    await expect(page.locator("body")).toContainText(/aceptá términos y privacidad para continuar con Google/i);
  });

  test("aviso de privacidad no genera desborde en mobile", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Preferencias de privacidad")).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
