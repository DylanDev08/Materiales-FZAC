import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const catalogCss = read("../../styles/catalog.css");
const detailCss = read("../../styles/product.css");
const card = read("../../components/product/product-card.tsx");
const buybox = read("../../components/product/product-buybox.tsx");
const detail = read("../../components/product/product-detail.tsx");

test("catalog product visual hierarchy supports large imagery, visible pricing and mobile", () => {
  assert.match(catalogCss, /Product storefront visual refresh/);
  assert.match(catalogCss, /grid-template-rows: clamp\(188px, 18vw, 240px\)/);
  assert.match(catalogCss, /\.product-card__price strong/);
  assert.match(catalogCss, /\.product-card:focus-within/);
  assert.match(catalogCss, /@media \(max-width: 400px\)/);
  assert.match(catalogCss, /prefers-reduced-motion: reduce/);
});

test("visual refresh keeps product cart, quantity and consultation actions", () => {
  assert.match(card, /addItem\(product, quantity\)/);
  assert.match(card, /getWhatsAppHref\(/);
  assert.match(card, /productLinePricing\(product, quantity\)/);
  assert.match(card, /canAddProductToCart\(product\)/);
  assert.match(card, /<Link className="product-card__media"/);
  assert.match(card, /product-card__selected-total/);
});

test("individual product maintains gallery, detailed buybox and information", () => {
  assert.match(detailCss, /Premium but functional product detail layout/);
  assert.match(detailCss, /\.product-gallery__main/);
  assert.match(detailCss, /\.product-buybox/);
  assert.match(detail, /<ProductGallery/);
  assert.match(detail, /<ProductBuyBox/);
  assert.match(buybox, /function buyNow\(/);
  assert.match(buybox, /addItem\(product, quantity\)/);
  assert.match(buybox, /getWhatsAppHref\(/);
});
