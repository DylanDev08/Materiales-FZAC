import { expect, test, type Page } from "@playwright/test";

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

async function openKnowledgeAnswer(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.route("**/api/assistant", async (route) => {
    await route.continue({
      headers: { ...route.request().headers(), "x-fzac-load-test": "readonly" }
    });
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Abrir asistente FZAC" }).click();
  await page.getByLabel("Consulta para el asistente FZAC").fill("¿Qué datos personales guarda FZAC?");
  await page.getByRole("button", { name: "Enviar consulta" }).click();

  const source = page.getByRole("link", { name: "Política de privacidad" }).last();
  await expect(source).toBeVisible();
  await expect(source).toHaveAttribute("href", "/privacidad");
  await expect(page.getByText("Fuente FZAC:").last()).toBeVisible();
  await expect(page.locator(".chatbot__inline-options").last().locator("a, button")).toHaveCount(3);
  await expect(page.getByLabel("Valorar respuesta")).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

test("muestra conocimiento trazable en desktop", async ({ page }) => {
  await openKnowledgeAnswer(page, { width: 1440, height: 900 });
});

test("mantiene el conocimiento usable en mobile", async ({ page }) => {
  await openKnowledgeAnswer(page, { width: 390, height: 844 });
  const chat = page.getByRole("dialog", { name: "Asistente FZAC" });
  await expect(chat).toBeVisible();
  const box = await chat.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
  expect(box?.height ?? 0).toBeLessThanOrEqual(844);
  const touchTargets = await chat.locator("button, a").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(touchTargets.filter((height) => height > 0).every((height) => height >= 44)).toBe(true);
  const inputHeight = await page.getByLabel("Consulta para el asistente FZAC").evaluate((element) => element.getBoundingClientRect().height);
  expect(inputHeight).toBeGreaterThanOrEqual(48);
  await page.getByRole("button", { name: "Cerrar chat" }).click();
  await expect(chat).toBeHidden();
});

for (const viewport of [{ width: 360, height: 740 }, { width: 414, height: 896 }]) {
  test(`abre y cierra el dialogo sin desborde en ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Abrir asistente FZAC" }).click();
    const dialog = page.getByRole("dialog", { name: "Asistente FZAC" });
    await expect(dialog).toBeVisible();
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      dialog: document.querySelector(".floating-chat")?.getBoundingClientRect().width ?? 0
    }));
    expect(layout.document).toBeLessThanOrEqual(layout.viewport + 1);
    expect(layout.dialog).toBeLessThanOrEqual(layout.viewport - 16);
    await page.locator(".floating-chat__backdrop").click({ position: { x: 2, y: 2 } });
    await expect(dialog).toBeHidden();
  });
}
