import { expect, test } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "La API de envío se valida una sola vez.");
});

test("rechaza direcciones incompletas antes de consultar Google", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: { street: "A", number: "", city: "Rosario", province: "Santa Fe" }
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(String(body.error ?? body.message)).toMatch(/calle|direcci[oó]n|caracteres/i);
});

test("una dirección válida falla cerrada cuando no hay tarifa comercial", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: { street: "Córdoba", number: "1200", city: "Rosario", province: "Santa Fe" }
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(body.available).toBe(false);
  expect(body.amount).toBe(0);
  expect(body.reason).toMatch(/tarifa vigente/i);
});
