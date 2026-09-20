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
  assert.match(source, /\/[a-z]\//);
  assert.match(source, /\/[A-Z]\//);
  assert.match(source, /\\d/);
  assert.match(source, /Un símbolo/);
});
