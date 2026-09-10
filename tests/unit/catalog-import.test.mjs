import assert from "node:assert/strict";
import test from "node:test";
import { classify, normalizeText, parseProducts, salePrice } from "../../scripts/catalog/import-la-yesera.mjs";

test("aplica exactamente 20% y redondea una sola vez", () => {
  assert.equal(salePrice(16100), 19320);
  assert.equal(salePrice(19990), 23988);
});

test("normaliza variantes de nombre para detectar duplicados potenciales", () => {
  assert.equal(
    normalizeText("PLACA DURLOCK 12,5mm 1,20 x 2,40 m"),
    normalizeText("Placas Drywall 12.5mm 1.20x2.40 mts")
  );
});

test("un source_product_id ya importado se actualiza sin recalcular sobre el precio de venta", () => {
  const source = {
    source_product_id: "42",
    original_name: "Placa Durlock",
    original_price: 100,
    sale_price: salePrice(100),
    source_sku: null,
    import_sku: "LYR-42",
    slug: "placa-durlock"
  };
  const [decision] = classify([source], {
    products: [{ id: "p1", name: source.original_name, slug: source.slug, sku: source.import_sku }],
    sources: [{ product_id: "p1", source_product_id: "42", original_price: 100 }]
  });
  assert.equal(decision.decision, "UPDATE_IMPORTED");
  assert.equal(decision.sale_price, 120);
});

test("omite filas sin precio válido y conserva imagen faltante como null", () => {
  const withoutPrice = `<div class="js-item-product" data-product-id="1"><div data-variants="[{&quot;price_number&quot;:0}]"><a href="https://tienda.layeserarosarina.com.ar/productos/x/" title="Producto X"></a>`;
  assert.deepEqual(parseProducts(withoutPrice, new Map()), []);

  const withoutImage = `<div class="js-item-product" data-product-id="2"><div data-variants="[{&quot;price_number&quot;:100,&quot;is_visible&quot;:true}]"><a href="https://tienda.layeserarosarina.com.ar/productos/y/" title="Producto Y"></a>`;
  const [row] = parseProducts(withoutImage, new Map());
  assert.equal(row.source_image_url, null);
  assert.equal(row.sale_price, 120);
});

test("una respuesta fuente vacía produce un dataset vacío sin inventar productos", () => {
  assert.deepEqual(parseProducts("", new Map()), []);
});
