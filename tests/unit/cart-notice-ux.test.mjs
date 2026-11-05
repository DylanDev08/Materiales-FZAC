import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const card = read("../../components/product/product-card.tsx");
const buybox = read("../../components/product/product-buybox.tsx");
const provider = read("../../components/cart/cart-provider.tsx");
const notice = read("../../components/cart/cart-notice.tsx");
const styles = read("../../styles/cart-notice.css");
const globals = read("../../app/globals.css");

test("catalog and detail use one shared cart notification", () => {
  assert.match(card, /notifyCartAction\(product\.name, quantity, success\)/);
  assert.match(buybox, /notifyCartAction\(product\.name, quantity, success\)/);
  assert.doesNotMatch(card, /product-card__toast/);
  assert.doesNotMatch(buybox, /product-added-toast/);
  assert.match(provider, /<CartNotice notice=\{notice\}/);
});

test("latest cart action replaces the previous message and expires", () => {
  assert.match(provider, /noticeSequence\.current \+= 1/);
  assert.match(provider, /setNotice\(\{ id: noticeSequence\.current/);
  assert.match(provider, /current\?\.id === notice\.id \? null : current/);
  assert.match(provider, /window\.clearTimeout\(timer\)/);
  assert.match(notice, /aria-label="Cerrar aviso del carrito"/);
  assert.match(notice, /href="\/carrito"/);
});

test("buy-now navigation does not display a success toast before checkout", () => {
  assert.match(buybox, /if \(!success\) notifyCartAction\(product\.name, quantity, false\)/);
  assert.match(buybox, /if \(success\) router\.push\("\/checkout"\)/);
});

test("notice fits mobile without covering the bottom navigation", () => {
  assert.match(globals, /styles\/cart-notice\.css/);
  assert.match(styles, /@media \(max-width: 600px\)/);
  assert.match(styles, /bottom: calc\(80px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(notice, /role=\{success \? "status" : "alert"\}/);
});

test("success notices are not shown when existing cart quantity reaches available stock", () => {
  assert.match(provider, /const existing = items\.find\(\(item\) => item\.productId === product\.id\)/);
  assert.match(provider, /const available = Number\(product\.stock\)/);
  assert.match(provider, /if \(\(existing\?\.quantity \?\? 0\) \+ quantity > limit\) return false/);
  assert.match(notice, /Revisá la cantidad o intentá nuevamente/);
});

test("desktop toast avoids floating assistant while mobile uses safe area", () => {
  assert.match(styles, /left: max\(18px, env\(safe-area-inset-left\)\)/);
  assert.match(styles, /right: auto/);
  assert.match(styles, /bottom: calc\(80px \+ env\(safe-area-inset-bottom\)\)/);
});

test("cart notice stays visible while hovered or keyboard-focused", () => {
  assert.match(provider, /if \(!notice \|\| noticePaused\) return/);
  assert.match(provider, /\[notice, noticePaused\]/);
  assert.match(provider, /onPauseChange=\{setNoticePaused\}/);
  assert.match(notice, /onMouseEnter=\{\(\) => onPauseChange\(true\)\}/);
  assert.match(notice, /onFocusCapture=\{\(\) => onPauseChange\(true\)\}/);
  assert.match(notice, /event\.currentTarget\.contains\(event\.relatedTarget\)/);
  assert.match(notice, /onPauseChange\(event\.currentTarget\.contains\(document\.activeElement\)\)/);
  assert.match(notice, /onPauseChange\(event\.currentTarget\.matches\(":hover"\)\)/);
});
