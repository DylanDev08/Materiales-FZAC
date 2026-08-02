import { expect, test, type Page } from "@playwright/test";

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

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
}

test("muestra conocimiento trazable en desktop", async ({ page }) => {
  await openKnowledgeAnswer(page, { width: 1440, height: 900 });
});

test("mantiene el conocimiento usable en mobile", async ({ page }) => {
  await openKnowledgeAnswer(page, { width: 390, height: 844 });
  const chat = page.locator(".floating-chat");
  await expect(chat).toBeVisible();
  const box = await chat.boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(390);
});
