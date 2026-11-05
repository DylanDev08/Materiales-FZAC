import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Exercise the exact TypeScript helper consumed by CartProvider, not a copy.
const source = readFileSync(new URL("../../lib/products/cart-quantity.ts", import.meta.url), "utf8");
const compiled = stripTypeScriptTypes(source, { mode: "strip" });
const { canAppendCartQuantity } = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(compiled)}`);

test("a new product adds only a quantity within its available stock", () => {
  assert.equal(canAppendCartQuantity(0, 1, 1), true);
  assert.equal(canAppendCartQuantity(0, 2, 1), false);
  assert.equal(canAppendCartQuantity(0, 5, 5), true);
  assert.equal(canAppendCartQuantity(0, 6, 5), false);
});

test("repeated clicks must respect units already stored in the cart", () => {
  assert.equal(canAppendCartQuantity(2, 1, 3), true);
  assert.equal(canAppendCartQuantity(3, 1, 3), false);
  assert.equal(canAppendCartQuantity(2, 2, 3), false);
  assert.equal(canAppendCartQuantity(3, 0, 3), false);
});

test("unconfirmed or zero stock keeps the consultation ceiling", () => {
  assert.equal(canAppendCartQuantity(0, 1, 0), true);
  assert.equal(canAppendCartQuantity(998, 1, 0), true);
  assert.equal(canAppendCartQuantity(999, 1, 0), false);
  assert.equal(canAppendCartQuantity(999, 1, Number.NaN), false);
});

test("invalid, fractional or negative quantities cannot be confirmed", () => {
  for (const quantity of [-1, 0, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(canAppendCartQuantity(0, quantity, 20), false);
  }
  for (const current of [-1, 1.5, Number.NaN]) {
    assert.equal(canAppendCartQuantity(current, 1, 20), false);
  }
});
