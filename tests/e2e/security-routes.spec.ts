import crypto from "node:crypto";
import { expect, test } from "@playwright/test";
import { validateMercadoPagoSignature } from "../../lib/payments/mercadopago-signature";
import { getRequestSiteUrl } from "../../lib/utils/env";
import { safeInternalPath } from "../../lib/utils/navigation";

test.describe("Controles de seguridad no destructivos", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Los controles API se ejecutan una sola vez.");
  });

  test("las APIs administrativas bloquean sesiones anónimas", async ({ request }) => {
    const [metrics, environment] = await Promise.all([
      request.get("/api/admin/metrics"),
      request.get("/api/health/env")
    ]);
    expect([401, 403]).toContain(metrics.status());
    expect([401, 403]).toContain(environment.status());
  });

  test("la comprobación pública de email no permite enumerar cuentas", async ({ request }) => {
    const first = await request.post("/api/auth/email-exists", { data: { email: "usuario-inexistente@example.com" } });
    const second = await request.post("/api/auth/email-exists", { data: { email: "otro-usuario@example.com" } });

    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);
    expect(await first.json()).toEqual({ checked: false });
    expect(await second.json()).toEqual({ checked: false });
    expect(first.headers()["cache-control"]).toContain("no-store");
  });

  test("las mutaciones administrativas bloquean origen cruzado antes de escribir", async ({ request }) => {
    const response = await request.patch("/api/admin/consumer-refund-requests/00000000-0000-4000-8000-000000000000", {
      headers: { Origin: "https://example.invalid", "Sec-Fetch-Site": "cross-site" },
      data: { status: "CLOSED", resolutionNote: "Prueba sin escritura" }
    });
    expect(response.status()).toBe(403);
  });

  test("el webhook vacío responde rápido y no consulta al proveedor", async ({ request }) => {
    const response = await request.post("/api/webhooks/mercadopago", { data: {} });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, ignored: true });
  });

  test("el colector CSP acepta reportes acotados y rechaza JSON inválido", async ({ request }) => {
    const accepted = await request.post("/api/security/csp-report", {
      headers: { "Content-Type": "application/csp-report" },
      data: {
        "csp-report": {
          "effective-directive": "script-src",
          "blocked-uri": "https://example.invalid/script.js",
          "document-uri": "https://example.invalid/"
        }
      }
    });
    expect(accepted.status()).toBe(204);

    const rejected = await request.post("/api/security/csp-report", {
      headers: { "Content-Type": "application/csp-report" },
      data: "{invalid-json"
    });
    expect(rejected.status()).toBe(400);
  });

  test("las páginas publican headers defensivos y política CSP report-only", async ({ request }) => {
    const response = await request.get("/");
    expect(response.headers()["x-content-type-options"]).toBe("nosniff");
    expect(response.headers()["x-frame-options"]).toBe("DENY");
    expect(response.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(response.headers()["content-security-policy-report-only"]).toContain("report-uri /api/security/csp-report");
  });
});

test.describe("Firma Mercado Pago aislada", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "La función pura se prueba una sola vez.");
  });

  test("producción nunca permite webhook sin secret", () => {
    expect(validateMercadoPagoSignature({
      webhookSecret: "",
      paymentsEnv: "production",
      dataId: "123",
      xSignature: null,
      xRequestId: null
    })).toBe(false);
  });

  test("test puede operar sin secret y una firma inválida se rechaza si hay secret", () => {
    expect(validateMercadoPagoSignature({
      webhookSecret: "",
      paymentsEnv: "test",
      dataId: "123",
      xSignature: null,
      xRequestId: null
    })).toBe(true);
    expect(validateMercadoPagoSignature({
      webhookSecret: "secret-local",
      paymentsEnv: "test",
      dataId: "123",
      xSignature: "ts=1,v1=incorrecta",
      xRequestId: "request-1"
    })).toBe(false);
  });

  test("acepta exactamente la firma HMAC esperada", () => {
    const secret = "secret-local";
    const dataId = "998877";
    const requestId = "request-safe";
    const ts = "1720000000";
    const digest = crypto
      .createHmac("sha256", secret)
      .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
      .digest("hex");

    expect(validateMercadoPagoSignature({
      webhookSecret: secret,
      paymentsEnv: "test",
      dataId,
      xSignature: `ts=${ts},v1=${digest}`,
      xRequestId: requestId
    })).toBe(true);
  });
});

test.describe("Origen canónico", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "La función pura se prueba una sola vez.");
  });

  test("el dominio configurado prevalece sobre Host reenviado", () => {
    const previous = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://tienda.fzac.example/ruta-ignorada";
    try {
      const request = new Request("https://servidor-interno.invalid/api/auth/register", {
        headers: {
          "x-forwarded-host": "atacante.invalid",
          "x-forwarded-proto": "https"
        }
      });
      expect(getRequestSiteUrl(request)).toBe("https://tienda.fzac.example");
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
      else process.env.NEXT_PUBLIC_SITE_URL = previous;
    }
  });

  test("las redirecciones de autenticación quedan dentro de FZAC", () => {
    expect(safeInternalPath("/checkout?paso=pago")).toBe("/checkout?paso=pago");
    expect(safeInternalPath("//atacante.invalid")).toBe("/cuenta");
    expect(safeInternalPath("/\\atacante.invalid")).toBe("/cuenta");
    expect(safeInternalPath("/%5C%5Catacante.invalid")).toBe("/cuenta");
    expect(safeInternalPath("/%2F%2Fatacante.invalid")).toBe("/cuenta");
  });
});
