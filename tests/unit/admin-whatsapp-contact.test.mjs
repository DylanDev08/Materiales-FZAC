import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Execute the actual helper, instead of matching its source text.
const typescript = readFileSync(new URL("../../lib/utils/contact.ts", import.meta.url), "utf8");
const javascript = stripTypeScriptTypes(typescript, { mode: "strip" });
const { getCustomerWhatsAppHref } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(javascript)}`);

test("customer WhatsApp uses Argentine mobile dialing for supported input formats", () => {
  const text = "Hola, pedido #123";
  const expected = `https://wa.me/5493411234567?text=${encodeURIComponent(text)}`;
  for (const number of ["3411234567", "+54 341 123 4567", "5493411234567", "+54 9 341 123-4567"]) {
    assert.equal(getCustomerWhatsAppHref(number, text), expected);
  }
});

test("invalid or absent customer phone never falls back to the FZAC support number", () => {
  for (const number of [null, undefined, "", "123", "abc", "https://wa.me/5491111111111", "541"]) {
    assert.equal(getCustomerWhatsAppHref(number, "Pedido"), null);
  }
});

test("customer message is URL encoded, never interpreted as query controls", () => {
  const url = getCustomerWhatsAppHref("3411234567", "Pedido #15 & pago=transferencia");
  assert.equal(url, "https://wa.me/5493411234567?text=Pedido%20%2315%20%26%20pago%3Dtransferencia");
});
