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
  expect(String(body.error ?? body.message)).toMatch(/calle|direcci[oó]n|caracteres|Google/i);
});

test("rechaza una dirección escrita manualmente si no fue seleccionada desde Google Places", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: { street: "Córdoba", number: "1200", city: "Rosario", province: "Santa Fe" }
  });
  const body = await response.json();

  expect(response.status()).toBe(422);
  expect(body.available ?? false).toBe(false);
  expect(String(body.error ?? body.message ?? body.reason)).toMatch(/direcci[oó]n sugerida|Google Maps|Google Places/i);
  expect(Number(body.amount ?? 0)).toBe(0);
  expect(JSON.stringify(body)).not.toMatch(/AIza|API_KEY_HTTP_REFERRER_BLOCKED|projects\//i);
});

test("un placeId inválido falla cerrado sin filtrar secretos", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: {
      placeId: "ChIJ-invalid-place-id-for-fzac-qa",
      street: "Córdoba",
      number: "1200",
      city: "Rosario",
      province: "Santa Fe"
    }
  });
  const body = await response.json();

  expect([422, 429]).toContain(response.status());
  if (response.status() === 422) {
    expect(body.available).toBe(false);
    expect(Number(body.amount ?? 0)).toBe(0);
    expect(String(body.reason ?? body.error ?? body.message)).toMatch(
      /direcci[oó]n|distancia|Google Maps|Routes API|retiro sin costo|WhatsApp/i
    );
  }
  expect(JSON.stringify(body)).not.toMatch(/AIza|API_KEY_HTTP_REFERRER_BLOCKED|projects\//i);
});
