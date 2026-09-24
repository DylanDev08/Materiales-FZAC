import assert from "node:assert/strict";
import test from "node:test";
import {
  classify,
  isAroProduct,
  isSupplementalDryProduct,
  marginPercent,
  normalizeText,
  parseProducts,
  salePrice
} from "../../scripts/catalog/import-la-yesera.mjs";
import { storefrontCategorySlug } from "../../scripts/catalog/sync-storefront-taxonomy.mjs";
import {
  classify as classifyUniverso,
  commercialScope as universoCommercialScope,
  parseProduct as parseUniversoProduct
} from "../../scripts/catalog/import-universo-pinturas.mjs";
import { expectedPrice as expectedSupplierPrice } from "../../scripts/catalog/audit-supplier-price-parity.mjs";

test("aplica margenes comerciales moderados y redondea una sola vez", () => {
  assert.equal(salePrice(16100), 18032);
  assert.equal(salePrice(19990), 22389);
  assert.equal(salePrice(20000), 22400);
  assert.equal(salePrice(20000.01), 22000);
  assert.equal(salePrice(60000), 66000);
});

test("reduce margen a 8% en productos de mayor valor", () => {
  assert.equal(isAroProduct({ original_name: "ARO PARA DURLOCK 90 MM" }), true);
  assert.equal(isAroProduct({ original_name: "CLAVO PUNTA PARIS" }), false);
  assert.equal(marginPercent({ original_price: 20000 }), 12);
  assert.equal(marginPercent({ original_price: 20000.01 }), 10);
  assert.equal(marginPercent({ original_price: 60000 }), 10);
  assert.equal(marginPercent({ original_price: 60000.01 }), 8);
  assert.equal(salePrice(10000, { original_name: "Aro de embutir" }), 11200);
  assert.equal(salePrice(10000, { original_name: "Placa Durlock" }), 11200);
  assert.equal(salePrice(135000), 145800);
  assert.equal(salePrice(69600), 75168);
  assert.equal(salePrice(96700), 104436);
  assert.equal(salePrice(65000), 70200);
  assert.throws(() => salePrice(0), /Precio proveedor inválido/);
});

test("limita el catálogo general a complementos inequívocos de construcción en seco", () => {
  assert.equal(isSupplementalDryProduct({ original_name: "LANA DE VIDRIO DURLOCK 50 MM" }), true);
  assert.equal(isSupplementalDryProduct({ original_name: "PGU 100-35 E 0,93 X 3 ML" }), true);
  assert.equal(isSupplementalDryProduct({ original_name: "YESO TRADICIONAL 30 KG" }), false);
});

test("normaliza variantes de nombre para detectar duplicados potenciales", () => {
  assert.equal(
    normalizeText("PLACA DURLOCK 12,5mm 1,20 x 2,40 m"),
    normalizeText("Placas Drywall 12.5mm 1.20x2.40 mts")
  );
  assert.equal(normalizeText("Látex interior"), "latex interior");
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
  assert.equal(decision.sale_price, 112);
});

test("omite filas sin precio válido y conserva imagen faltante como null", () => {
  const withoutPrice = `<div class="js-item-product" data-product-id="1"><div data-variants="[{&quot;price_number&quot;:0}]"><a href="https://tienda.layeserarosarina.com.ar/productos/x/" title="Producto X"></a>`;
  assert.deepEqual(parseProducts(withoutPrice, new Map()), []);

  const withoutImage = `<div class="js-item-product" data-product-id="2"><div data-variants="[{&quot;price_number&quot;:100,&quot;is_visible&quot;:true}]"><a href="https://tienda.layeserarosarina.com.ar/productos/y/" title="Producto Y"></a>`;
  const [row] = parseProducts(withoutImage, new Map());
  assert.equal(row.source_image_url, null);
  assert.equal(row.sale_price, 112);
});

test("una respuesta fuente vacía produce un dataset vacío sin inventar productos", () => {
  assert.deepEqual(parseProducts("", new Map()), []);
});

test("clasifica el catálogo público sin inferir categorías fuera de reglas verificables", () => {
  assert.equal(storefrontCategorySlug("TORNILLOS T2 - 6X1 X 100"), "ferreteria");
  assert.equal(storefrontCategorySlug("PGC 100-40-17-E 0,93 X 3 mts"), "steel-framing");
  assert.equal(storefrontCategorySlug("PLACA SUPERBOARD 10mm BORDE RECTO"), "steel-framing");
  assert.equal(storefrontCategorySlug("PLACAS DURLOCK 12,5mm 1,20 x 2,40"), "construccion-en-seco");
});

test("Universo conserva el precio público, no importa stock y exige consulta", () => {
  const [row] = parseUniversoProduct({
    productId: "100",
    productName: "Látex interior 4 l",
    link: "https://www.tiendauniverso.com.ar/latex-interior/p",
    brand: "Marca real",
    categories: ["/PINTURAS/LATEX/"],
    description: "Pintura para interiores.",
    items: [{
      itemId: "200",
      nameComplete: "Látex interior 4 l",
      measurementUnit: "un",
      images: [{ imageUrl: "https://example.com/latex.jpg" }],
      sellers: [{ commertialOffer: { Price: 12500, ListPrice: 14000, AvailableQuantity: 100 } }]
    }]
  });
  assert.equal(row.original_price, 12500);
  assert.equal(row.sale_price, 12500);
  assert.equal(row.margin_percent, 0);
  assert.equal(row.stock, null);
  assert.equal(row.availability_status, "CONSULT");
});

test("Universo omite variantes sin precio y detecta duplicados por nombre normalizado", () => {
  const empty = parseUniversoProduct({
    productId: "101",
    link: "https://www.tiendauniverso.com.ar/sin-precio/p",
    items: [{ itemId: "201", sellers: [{ commertialOffer: { Price: 0 } }] }]
  });
  assert.deepEqual(empty, []);

  const source = {
    source_product_id: "101:201",
    original_name: "Esmalte sintético blanco 1 l",
    original_price: 100,
    sale_price: 100,
    import_sku: "UNV-201",
    source_sku: "201",
    slug: "esmalte-sintetico-blanco-1-l"
  };
  const [decision] = classifyUniverso([source], {
    products: [{ id: "existing", name: "Esmalte sintetico blanco 1 L", slug: "otro-slug", sku: "FZAC-1", supplier_id: null }],
    sources: [],
    supplier: null
  });
  assert.equal(decision.decision, "SKIP_DUPLICATE");
});

test("Universo deja categorías dudosas en preview y mantiene pinturas de obra", () => {
  assert.equal(universoCommercialScope({ original_name: "Látex interior blanco 20 l", subcategory: "Pinturas" }), "INCLUDE");
  assert.equal(universoCommercialScope({ original_name: "Recubrimiento para bordes", subcategory: "Piletas" }), "REVIEW");
});

test("la auditoría conserva centavos de Universo y redondea Yesera", () => {
  assert.equal(expectedSupplierPrice("UNIVERSO-PINTURAS-SRL", 123.45), 123.45);
  assert.equal(expectedSupplierPrice("LA-YESERA-ROSARINA", 69600), 75168);
});


test("Universo manda precios fuente sospechosamente bajos a revisión manual", () => {
  const [row] = parseUniversoProduct({
    productId: "999",
    productName: "Producto sospechoso",
    link: "https://www.tiendauniverso.com.ar/producto-sospechoso/p",
    brand: "Marca",
    categories: ["/PINTURAS/ESMALTES/"],
    description: "Producto de prueba.",
    items: [{
      itemId: "998",
      nameComplete: "Producto sospechoso",
      measurementUnit: "un",
      images: [],
      sellers: [{ commertialOffer: { Price: 49.05, AvailableQuantity: 0 } }]
    }]
  });
  assert.equal(row.price_review_required, true);

  const [decision] = classifyUniverso([row], {
    products: [],
    sources: [],
    supplier: null
  });
  assert.equal(decision.decision, "REVIEW_PRICE");
});
