import { expect, test } from "@playwright/test";

test.beforeEach(async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "La barrera MFA se valida una sola vez.");
});

test("el enrolamiento MFA administrativo exige sesion y no se indexa", async ({ request }) => {
  const response = await request.get("/seguridad-admin", { maxRedirects: 0 });
  expect([302, 303, 307, 308]).toContain(response.status());
  expect(new URL(response.headers().location, response.url()).pathname).toBe("/login");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["x-robots-tag"]).toContain("noindex");
});
