import { expect, test } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "La API de envío se valida una sola vez.");
});

const address = { street: "Córdoba", number: "1200", city: "Rosario", province: "Santa Fe" };

test("rechaza direcciones incompletas antes de consultar Google", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: {
      street: "A", number: "", city: "Rosario", province: "Santa Fe",
      items: [{ product_id: "SKU-INEXISTENTE-PARA-QA", quantity: 1 }]
    }
  });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(String(body.error ?? body.message)).toMatch(/calle|direcci[oó]n|caracteres|Google/i);
});

test("no permite cotizar un envío sin carrito", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", { data: { ...address, items: [] } });
  expect(response.status()).toBe(422);
  const body = await response.json();
  expect(String(body.error ?? body.message)).toMatch(/carrito/i);
  expect(JSON.stringify(body)).not.toMatch(/AIza|API_KEY_HTTP_REFERRER_BLOCKED|projects\//i);
});

test("rechaza productos inexistentes sin aceptar metadatos logísticos enviados por el cliente", async ({ request }) => {
  const response = await request.post("/api/shipping/quote", {
    data: {
      ...address,
      placeId: "ChIJ-invalid-place-id-for-fzac-qa",
      // Browser-provided unload data is intentionally untrusted and discarded.
      shipping_unload_minutes_per_unit: 0,
      hourlyRate: 0,
      items: [{ product_id: "SKU-INEXISTENTE-PARA-QA", quantity: 1 }]
    }
  });
  expect([409, 429]).toContain(response.status());
  const body = await response.json();
  if (response.status() === 409) {
    expect(body.available).toBe(false);
    expect(body.amount).toBe(0);
    expect(String(body.error)).toBe("CART_UNAVAILABLE");
  }
  expect(JSON.stringify(body)).not.toMatch(/AIza|API_KEY_HTTP_REFERRER_BLOCKED|projects\//i);
});
