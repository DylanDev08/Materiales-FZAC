import { expect, test } from "@playwright/test";

test.describe("Auth manual y checkout no destructivo", () => {
  test.beforeEach(async ({ page }) => {
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

  test("login manual expone email, contraseña y recuperación sin textos de prueba", async ({ page }) => {
    await page.goto("/login?next=/checkout", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/^Email$/i)).toBeVisible();
    await expect(page.getByLabel(/^Contraseña$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^Ingresar$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Recuperar contraseña/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Registrate/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/TESTUSER|entorno de prueba|texto de prueba|lorem ipsum/i);
  });

  test("registro manual contiene datos, confirmación y aceptación legal", async ({ page }) => {
    await page.goto("/registro", { waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(/Nombre y apellido/i)).toBeVisible();
    await expect(page.getByLabel(/Teléfono/i)).toBeVisible();
    await expect(page.getByLabel(/^Email$/i)).toBeVisible();
    await expect(page.getByLabel(/^Contraseña$/i)).toBeVisible();
    await expect(page.getByLabel(/Confirmar contraseña/i)).toBeVisible();
    await expect(page.getByText(/Acepto/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Registrarme/i })).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/TESTUSER|entorno de prueba|texto de prueba|lorem ipsum/i);
  });

  test("checkout anónimo redirige al login preservando destino interno", async ({ request }) => {
    const response = await request.get("/checkout", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    const location = response.headers()["location"] ?? "";
    expect(location).toContain("/login");
    expect(decodeURIComponent(location)).toContain("next=/checkout");
  });

  test("alias /register redirige a /registro", async ({ request }) => {
    const response = await request.get("/register", { maxRedirects: 0 });
    expect([302, 303, 307, 308]).toContain(response.status());
    expect(response.headers()["location"] ?? "").toContain("/registro");
  });

  test("producción no muestra bandera de pagos de prueba", async ({ request }) => {
    const base = new URL(process.env.BASE_URL || "http://localhost:3000");
    test.skip(!/fzacmateriales\.store$|onrender\.com$/.test(base.hostname), "Chequeo exclusivo de runtime productivo.");

    const status = await request.get("/api/payments/mercadopago");
    expect(status.status()).toBe(200);
    const body = await status.json();
    expect(body.environment).toBe("production");
    expect(body.enabled).toBe(true);
    expect(body.cardEnabled).toBe(true);
    expect(body.productionReadiness?.blockers ?? []).toEqual([]);
  });
});
