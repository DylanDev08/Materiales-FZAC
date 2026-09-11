import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "El catálogo se valida una vez en desktop.");
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

test("Home presenta el catálogo enfocado y productos reales", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Todo para construir en seco, en un solo lugar." })).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/La Yesera Rosarina|precio proveedor|margen comercial/i);

  for (const category of ["Construcción en Seco", "Steel Framing", "Ferretería"]) {
    await expect(page.getByRole("link", { name: new RegExp(category, "i") }).first()).toBeVisible();
  }
});

test("catálogo público limita proveedor, rubros e imágenes", async ({ page }) => {
  await page.goto("/productos?availability=CONSULT", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".catalog-toolbar")).toContainText("109");
  await expect(page.locator(".catalog-category-rail a")).toHaveCount(4);
  await expect(page.locator(".catalog-category-rail")).not.toContainText(/Electricidad|Plomería|Pintura/i);
  await expect(page.locator("body")).not.toContainText(/Yesera Rosarina|Urbe SRL|Maquinaria Sorrentos/i);

  const sources = await page.locator(".product-card img").evaluateAll((images) =>
    images.slice(0, 12).map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src)
  );
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.every((source) => decodeURIComponent(source).includes("supabase.co/storage/v1/object/public/product-images/la-yesera-rosarina/"))).toBe(true);
});

test("manifest instala iconos grandes y maskable", async ({ request }) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "/icons/icon-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "/icons/icon-512.png", sizes: "512x512" }),
    expect.objectContaining({ src: "/icons/maskable-512.png", purpose: "maskable" })
  ]));
});
