import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "El catálogo se valida una vez en desktop.");
  await page.addInitScript(() => {
    window.sessionStorage.setItem("fzac-entry-complete-v1", "true");
    window.localStorage.setItem("fzac-privacy-consent-v1", JSON.stringify({
      version: "2026-09-24",
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
  await expect(page.getByRole("heading", { name: "Materiales y pinturas para avanzar con tu obra." })).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/La Yesera Rosarina|precio proveedor|margen comercial/i);

  for (const category of ["Construcción en Seco", "Steel Framing", "Ferretería", "Pinturas"]) {
    await expect(page.getByRole("link", { name: new RegExp(category, "i") }).first()).toBeVisible();
  }
});

test("catálogo público limita proveedor, rubros e imágenes", async ({ page }) => {
  await page.goto("/productos?availability=CONSULT", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".catalog-toolbar:not(.catalog-toolbar--skeleton)")).toContainText("110");
  await expect(page.locator(".catalog-category-rail a")).toHaveCount(5);
  await expect(page.locator(".catalog-category-rail")).toContainText(/Pintura/i);
  await expect(page.locator("body")).not.toContainText(/Yesera Rosarina|Universo Pinturas|Urbe SRL|Maquinaria Sorrentos/i);
  const documentSource = await page.content();
  expect(documentSource).not.toMatch(/original_price|margin_percent|source_image_url|product_supplier_sources/i);

  const sources = await page.locator(".product-card img").evaluateAll((images) =>
    images.slice(0, 12).map((image) => (image as HTMLImageElement).currentSrc || (image as HTMLImageElement).src)
  );
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.every((source) => !/universo-pinturas/i.test(decodeURIComponent(source)))).toBe(true);
});

for (const search of [
  "durlock",
  "placa",
  "placas",
  "montante",
  "montantes",
  "solera",
  "soleras",
  "perfil",
  "perfiles",
  "masilla",
  "cinta",
  "tornillo",
  "cielorraso",
  "pvc",
  "lana de vidrio",
  "PGU",
  "PGC"
]) {
  test(`la búsqueda ${search} devuelve productos reales`, async ({ page }) => {
    await page.goto(`/productos?search=${encodeURIComponent(search)}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".product-card").first()).toBeVisible();
  });
}

test("la disponibilidad separa productos a consultar del stock comprable", async ({ page }) => {
  await page.goto("/productos?availability=CONSULT", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".catalog-toolbar")).toContainText("110");
  await expect(page.locator(".product-card").first()).toContainText(/consultar disponibilidad/i);

  await page.goto("/productos?availability=IN_STOCK", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".product-card")).toHaveCount(2);
  await expect(page.locator(".catalog-product-column")).toContainText(/Cemento Portland/i);
  await expect(page.locator(".catalog-product-column")).toContainText(/Placa Drywall 12,5mm/i);
  await expect(page.locator("select").filter({ has: page.locator("option[value='IN_STOCK']") }).last()).toHaveValue("IN_STOCK");
});

test("un producto a consultar se añade al carrito y pide confirmación antes del pago", async ({ page }) => {
  await page.goto("/categoria/construccion-en-seco?availability=CONSULT", { waitUntil: "domcontentloaded" });
  const firstCard = page.locator(".product-card").first();
  await expect(firstCard).toBeVisible();
  await firstCard.getByRole("button", { name: "Añadir al carrito" }).click();
  await expect(firstCard.getByRole("status")).toContainText("Producto añadido al carrito");

  await page.goto("/carrito", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".cart-line").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /solicitar disponibilidad/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /continuar al checkout/i })).toHaveCount(0);
});

test("Pinturas queda vacío sin reactivar el catálogo de referencia de Universo", async ({ page }) => {
  await page.goto("/categoria/pintura-impermeabilizacion", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".empty-state")).toContainText(/no encontramos productos/i);
  await expect(page.locator(".product-card")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/Universo Pinturas/i);
});

test("la búsqueda combinada de montantes y soleras resuelve ambos tipos", async ({ page }) => {
  await page.goto("/productos?search=montantes%20y%20soleras", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".catalog-product-column")).toContainText(/montante/i);
  await expect(page.locator(".catalog-product-column")).toContainText(/solera/i);
});

test("aro informa un resultado vacío real en construcción en seco", async ({ page }) => {
  await page.goto("/categoria/construccion-en-seco?search=aro", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".empty-state")).toContainText(/no encontramos productos/i);
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
