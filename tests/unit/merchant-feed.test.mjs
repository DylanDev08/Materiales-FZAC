import test from "node:test";
import assert from "node:assert/strict";
import { buildMerchantFeed } from "../../lib/merchant/feed.ts";

const siteUrl = "https://www.fzacmateriales.store";

function product(overrides = {}) {
  return {
    id: "d7d3a504-2892-42a4-a694-cc81c34198ea",
    sku: "FZAC-DEMO-001",
    slug: "cemento-portland-50kg",
    name: "Cemento Portland x 50kg",
    description: "Cemento para obra y mampostería",
    image_url: "/assets/products/cemento.webp",
    gallery: ["https://example.com/cemento-side.webp"],
    category: { name: "Materiales de obra" },
    subcategory: "Cementos",
    availability_status: "IN_STOCK",
    stock: 25,
    price: 8500,
    compare_price: null,
    on_sale: false,
    promotion_type: "NONE",
    brand: "FZAC",
    specifications: {},
    ...overrides
  };
}

test("RSS preserves the product SKU and public URL used by Merchant Center", () => {
  const result = buildMerchantFeed([product()], siteUrl);
  assert.equal(result.included, 1);
  assert.equal(result.skipped.length, 0);
  assert.match(result.xml, /<g:id>FZAC-DEMO-001<\/g:id>/);
  assert.match(result.xml, /<link>https:\/\/www.fzacmateriales.store\/producto\/cemento-portland-50kg<\/link>/);
  assert.match(result.xml, /<g:image_link>https:\/\/www.fzacmateriales.store\/assets\/products\/cemento.webp<\/g:image_link>/);
  assert.match(result.xml, /<g:additional_image_link>https:\/\/example.com\/cemento-side.webp<\/g:additional_image_link>/);
  assert.match(result.xml, /<g:price>8500.00 ARS<\/g:price>/);
  assert.match(result.xml, /<g:availability>in_stock<\/g:availability>/);
});

test("discounted visible single-item retail price uses Google's sale_price, not quantity promotions", () => {
  const result = buildMerchantFeed([
    product({ sku: "sale", price: 7800, compare_price: 9000, on_sale: true }),
    product({ sku: "bundle", price: 7800, compare_price: 9000, on_sale: true, promotion_type: "TWO_FOR_ONE" })
  ], siteUrl);
  assert.match(result.xml, /<g:id>sale<\/g:id>.*?<g:price>9000.00 ARS<\/g:price><g:sale_price>7800.00 ARS<\/g:sale_price>/);
  assert.match(result.xml, /<g:id>bundle<\/g:id>.*?<g:price>7800.00 ARS<\/g:price>/);
  const bundle = result.xml.split("<g:id>bundle</g:id>")[1].split("</item>")[0];
  assert.doesNotMatch(bundle, /<g:sale_price>/);
});

test("unconfirmed inventory and zero-stock items are never marked available", () => {
  const result = buildMerchantFeed([
    product({ sku: "consult", availability_status: "CONSULT", stock: 25 }),
    product({ sku: "empty", availability_status: "IN_STOCK", stock: 0 })
  ], siteUrl);
  assert.equal((result.xml.match(/<g:availability>out_of_stock<\/g:availability>/g) ?? []).length, 2);
  assert.match(result.xml, /<g:custom_label_0>stock-a-confirmar<\/g:custom_label_0>/);
});

test("escapes XML and strips invalid control characters rather than generating malformed XML", () => {
  const result = buildMerchantFeed([product({
    name: 'Cinta & perfil <FZAC> "nueva"',
    description: "Más <grande>\u0007 & mejor"
  })], siteUrl);
  assert.match(result.xml, /Cinta &amp; perfil &lt;FZAC&gt; &quot;nueva&quot;/);
  assert.match(result.xml, /Más &lt;grande&gt; &amp; mejor/);
  assert.doesNotMatch(result.xml, /\u0007/);
});

test("missing required data is excluded while preserving healthy products", () => {
  const result = buildMerchantFeed([
    product(),
    product({ sku: "bad-price", price: 0 }),
    product({ sku: "bad-photo", image_url: "http://example.com/image.png" })
  ], siteUrl);
  assert.equal(result.included, 1);
  assert.deepEqual(result.skipped.map((issue) => issue.field), ["price", "image_link"]);
  assert.doesNotMatch(result.xml, /bad-price|bad-photo/);
});

test("duplicate SKU and empty or insecure feeds fail closed", () => {
  assert.throws(() => buildMerchantFeed([product(), product()], siteUrl), /duplicate product IDs/);
  assert.throws(() => buildMerchantFeed([product({ price: 0 })], siteUrl), /no valid products/);
  assert.throws(() => buildMerchantFeed([product()], "http://localhost:3000"), /HTTPS/);
});
