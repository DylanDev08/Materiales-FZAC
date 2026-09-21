import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("registro no enumera email, telefono ni nombre mediante prechecks", async () => {
  const source = await readFile(new URL("../../app/api/auth/register/route.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /findRegistrationDuplicate/);
  assert.doesNotMatch(source, /duplicateMessage/);
  assert.doesNotMatch(source, /\.ilike\("full_name"/);
  assert.doesNotMatch(source, /Ya existe una cuenta registrada/);
  assert.match(source, /genericRegistrationResponse\(\)/);
});

test("registro conserva la politica fuerte de contrasena alineada a ocho caracteres", async () => {
  const source = await readFile(new URL("../../lib/validations/auth.ts", import.meta.url), "utf8");

  assert.match(source, /password\.length >= 8/);
  assert.match(source, /\.min\(8, "La contraseña debe tener al menos 8 caracteres/);
  assert.match(source, /id: "lowercase"/);
  assert.match(source, /id: "uppercase"/);
  assert.match(source, /id: "number"/);
  assert.match(source, /id: "symbol"/);
  assert.match(source, /id: "common"/);
  assert.match(source, /id: "personal"/);
});


test("login no revela si la cuenta existe o si falta confirmar el email", async () => {
  const source = await readFile(new URL("../../app/api/auth/login/route.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /EMAIL_NOT_CONFIRMED/);
  assert.doesNotMatch(source, /Tu cuenta existe/);
  assert.match(source, /code: "AUTH_FAILED"/);
  assert.match(source, /confirmá tu email/);
});
