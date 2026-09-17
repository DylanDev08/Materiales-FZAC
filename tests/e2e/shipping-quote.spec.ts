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

test("una dirección válida no permite consumir Google sin sesión", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: { street: "Córdoba", number: "1200", city: "Rosario", province: "Santa Fe" }
  });
  const body = await response.json();

  expect(response.status()).toBe(401);
  expect(body.message).toMatch(/sesi[oó]n/i);
  expect(JSON.stringify(body)).not.toMatch(/AIza|API_KEY_HTTP_REFERRER_BLOCKED|projects\//i);
});

test("rechaza campos extra antes de consultar Google", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: {
      street: "Córdoba",
      number: "1200",
      city: "Rosario",
      province: "Santa Fe",
      shippingCost: 0
    }
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(String(body.error ?? body.message)).toMatch(/campos no permitidos|solicitud/i);
});
