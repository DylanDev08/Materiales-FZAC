import { expect, test } from "@playwright/test";
import { isAdminMfaSatisfied } from "@/lib/auth/admin-mfa-policy";
import { checkoutCreateSchema } from "@/lib/validations/checkout";
import { toPublicPaymentSummary } from "@/lib/payments/dto";
import { consumerRefundStatusEmailTemplate } from "@/lib/email/templates";

const validCheckout = {
  customer_name: "Cliente Seguro",
  customer_email: "cliente@example.com",
  customer_phone: "3415551234",
  shipping_method: "PICKUP",
  address_snapshot: {},
  payment_method: "MERCADOPAGO",
  payment_flow: "CHECKOUT_PRO",
  accepted_terms: true,
  idempotency_key: "checkout-test-123",
  items: [{ product_id: "00000000-0000-4000-8000-000000000001", quantity: 1 }]
};

test.describe("Integridad productiva pura", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Las reglas puras se prueban una sola vez.");
  });

  test("MFA administrativa requiere simultaneamente rol ADMIN y AAL2", () => {
    expect(isAdminMfaSatisfied("ADMIN", "aal2")).toBe(true);
    expect(isAdminMfaSatisfied("ADMIN", "aal1")).toBe(false);
    expect(isAdminMfaSatisfied("USER", "aal2")).toBe(false);
    expect(isAdminMfaSatisfied(null, null)).toBe(false);
  });

  test("checkout rechaza carrito vacio y cantidades fuera de rango", () => {
    expect(checkoutCreateSchema.safeParse({ ...validCheckout, items: [] }).success).toBe(false);
    for (const quantity of [0, -1, 1_000, Number.MAX_SAFE_INTEGER]) {
      expect(checkoutCreateSchema.safeParse({
        ...validCheckout,
        items: [{ ...validCheckout.items[0], quantity }]
      }).success).toBe(false);
    }
  });

  test("checkout no acepta precio, subtotal ni envio decididos por navegador", () => {
    const parsed = checkoutCreateSchema.parse({
      ...validCheckout,
      price: 1,
      subtotal: 1,
      total: 1,
      shipping_cost: 1,
      items: [{ ...validCheckout.items[0], price: 1, unit_price: 1, subtotal: 1 }]
    });

    expect(parsed).not.toHaveProperty("price");
    expect(parsed).not.toHaveProperty("subtotal");
    expect(parsed).not.toHaveProperty("total");
    expect(parsed).not.toHaveProperty("shipping_cost");
    expect(parsed.items[0]).not.toHaveProperty("price");
    expect(parsed.items[0]).not.toHaveProperty("unit_price");
  });

  test("retiro no exige direccion y delivery si exige direccion completa", () => {
    expect(checkoutCreateSchema.safeParse(validCheckout).success).toBe(true);
    expect(checkoutCreateSchema.safeParse({ ...validCheckout, shipping_method: "DELIVERY" }).success).toBe(false);
    expect(checkoutCreateSchema.safeParse({
      ...validCheckout,
      shipping_method: "DELIVERY",
      address_snapshot: { street: "Cordoba", number: "1200", city: "Rosario", province: "Santa Fe" }
    }).success).toBe(true);
  });

  test("DTO publico de pagos omite IDs y payloads privados", () => {
    const dto = toPublicPaymentSummary({
      id: "payment-private",
      order_id: "order-private",
      status: "PAID",
      provider: "MERCADOPAGO",
      amount: "12500.00",
      currency: "ars",
      updated_at: "2026-09-16T12:00:00.000Z",
      provider_payment_id: "provider-private",
      provider_session_id: "session-private",
      raw: { token: "secret" }
    });

    expect(dto).toEqual({
      status: "PAID",
      provider: "MERCADOPAGO",
      amount: 12500,
      currency: "ARS",
      updated_at: "2026-09-16T12:00:00.000Z"
    });
    expect(JSON.stringify(dto)).not.toMatch(/payment-private|order-private|provider-private|session-private|secret/);
  });

  test("emails escapan contenido controlado por usuario", () => {
    const email = consumerRefundStatusEmailTemplate({
      name: "<img src=x onerror=alert(1)>",
      requestNumber: "FZAC-TEST-1",
      orderNumber: "<script>alert(1)</script>",
      status: "En revision",
      resolutionNote: "<b>contenido</b>",
      actionUrl: "https://materiales.example/cuenta/solicitudes"
    });
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).not.toContain("<b>contenido</b>");
    expect(email.html).toContain("&lt;b&gt;contenido&lt;/b&gt;");
  });
});

test("Naranja X permanece deshabilitado hasta tener integracion oficial", async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "La capacidad se consulta una sola vez.");
  const status = await request.get("/api/payments/naranjax");
  expect(status.status()).toBe(200);
  await expect(status.json()).resolves.toMatchObject({ enabled: false, integrationStatus: "NOT_IMPLEMENTED" });

  const create = await request.post("/api/payments/naranjax", { data: {} });
  expect(create.status()).toBe(501);
  await expect(create.json()).resolves.toMatchObject({ enabled: false, code: "NARANJAX_NOT_IMPLEMENTED" });
});
