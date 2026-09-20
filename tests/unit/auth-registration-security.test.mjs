import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { registerSchema } from "../../lib/validations/auth.ts";

test("registro no enumera email, telefono ni nombre mediante prechecks", async () => {
  const source = await readFile(new URL("../../app/api/auth/register/route.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /findRegistrationDuplicate/);
  assert.doesNotMatch(source, /duplicateMessage/);
  assert.doesNotMatch(source, /\.ilike\("full_name"/);
  assert.doesNotMatch(source, /Ya existe una cuenta registrada/);
  assert.match(source, /genericRegistrationResponse\(\)/);
});

test("registro mantiene la politica fuerte de contrasena en ocho caracteres", () => {
  const base = {
    name: "Cliente Prueba",
    phone: "",
    email: "cliente@example.com",
    acceptedTerms: true,
    hp: ""
  };

  assert.equal(registerSchema.safeParse({
    ...base,
    password: "Ab1!cde",
    confirmPassword: "Ab1!cde"
  }).success, false);

  assert.equal(registerSchema.safeParse({
    ...base,
    password: "Ab1!cdef",
    confirmPassword: "Ab1!cdef"
  }).success, true);
});
