import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const REPORT_PATH = path.join("docs", "audits", "catalog-content-audit.md");
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_READ_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const allowedImageHosts = [
  "images.unsplash.com",
  "res.cloudinary.com",
  ".supabase.co"
];

function today() {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires"
  }).format(new Date());
}

function normalizeText(value) {
  return String(value || "").trim();
}

function imageHost(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  if (raw.startsWith("/")) return "local";
  try {
    return new URL(raw).hostname;
  } catch {
    return "invalid";
  }
}

function isAllowedImage(value) {
  const host = imageHost(value);
  if (!host) return false;
  if (host === "local") return true;
  return allowedImageHosts.some((allowed) => (allowed.startsWith(".") ? host.endsWith(allowed) : host === allowed));
}

function isPlaceholderImage(value) {
  const raw = normalizeText(value).toLowerCase();
  if (!raw) return true;
  return (
    raw.includes("placeholder") ||
    raw.includes("images.unsplash.com") ||
    raw.endsWith(".svg") ||
    raw.includes("/products/")
  );
}

function duplicateValues(rows, field) {
  const seen = new Map();
  const dupes = new Set();
  for (const row of rows) {
    const value = normalizeText(row[field]).toLowerCase();
    if (!value) continue;
    if (seen.has(value)) dupes.add(value);
    seen.set(value, true);
  }
  return Array.from(dupes).sort();
}

function money(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(
    Number(value || 0)
  );
}

function table(rows) {
  if (!rows.length) return "_Sin hallazgos._";
  return [
    "| Item | Estado | Acción sugerida |",
    "| --- | --- | --- |",
    ...rows.map((row) => `| ${row.item} | ${row.status} | ${row.action} |`)
  ].join("\n");
}

function shortList(values, limit = 12) {
  if (!values.length) return "_Sin elementos._";
  const visible = values.slice(0, limit).map((value) => `- ${value}`);
  if (values.length > limit) visible.push(`- ... ${values.length - limit} más`);
  return visible.join("\n");
}

async function loadCatalog() {
  if (!SUPABASE_URL || !SUPABASE_READ_KEY) {
    return { configured: false, products: [], categories: [], errors: ["Supabase no está configurado en el entorno."] };
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_READ_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const [productsResult, categoriesResult] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id,slug,sku,name,description,category_id,subcategory,brand,price,compare_price,stock,stock_minimum,unit,image_url,gallery,featured,on_sale,active,created_at,updated_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .limit(2500),
    supabase
      .from("categories")
      .select("id,name,slug,description,image_url,parent_id,active,sort_order", { count: "exact" })
      .order("sort_order", { ascending: true })
      .limit(500)
  ]);

  const errors = [];
  if (productsResult.error) errors.push(`Productos: ${productsResult.error.message}`);
  if (categoriesResult.error) errors.push(`Categorías: ${categoriesResult.error.message}`);

  return {
    configured: true,
    products: productsResult.data || [],
    productCount: productsResult.count || 0,
    categories: categoriesResult.data || [],
    categoryCount: categoriesResult.count || 0,
    errors
  };
}

function analyze({ configured, products, productCount, categories, categoryCount, errors }) {
  const activeProducts = products.filter((product) => product.active);
  const inactiveProducts = products.filter((product) => !product.active);
  const activeCategories = categories.filter((category) => category.active);
  const inactiveCategories = categories.filter((category) => !category.active);
  const activeCategoryIds = new Set(activeCategories.map((category) => category.id));
  const productCategoryIds = new Set(activeProducts.map((product) => product.category_id).filter(Boolean));

  const findings = [];
  if (!configured) {
    findings.push({ item: "Supabase", status: "Bloqueante", action: "Configurar variables para auditar datos reales." });
  }
  for (const error of errors) findings.push({ item: "Consulta Supabase", status: "Error", action: error });
  if (!activeCategories.length) {
    findings.push({ item: "Categorías activas", status: "Bloqueante", action: "Publicar al menos un rubro activo." });
  }
  if (!activeProducts.length) {
    findings.push({ item: "Productos activos", status: "Bloqueante", action: "Publicar productos reales antes de vender." });
  }

  const productsWithoutCategory = activeProducts.filter((product) => !activeCategoryIds.has(product.category_id));
  const productsWithoutImage = activeProducts.filter((product) => !normalizeText(product.image_url));
  const productsWithPlaceholderImage = activeProducts.filter((product) => isPlaceholderImage(product.image_url));
  const productsWithInvalidImage = activeProducts.filter((product) => product.image_url && !isAllowedImage(product.image_url));
  const productsWithoutDescription = activeProducts.filter((product) => normalizeText(product.description).length < 24);
  const productsWithoutBrand = activeProducts.filter((product) => normalizeText(product.brand).length < 2);
  const productsWithoutSku = activeProducts.filter((product) => normalizeText(product.sku).length < 2);
  const productsWithBadSlug = activeProducts.filter((product) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeText(product.slug)));
  const productsWithBadPrice = activeProducts.filter((product) => Number(product.price) <= 0);
  const productsWithoutStock = activeProducts.filter((product) => Number(product.stock) <= 0);
  const lowStockProducts = activeProducts.filter(
    (product) => Number(product.stock) > 0 && Number(product.stock) <= Number(product.stock_minimum || 0)
  );
  const categoriesWithoutDescription = activeCategories.filter((category) => normalizeText(category.description).length < 20);
  const categoriesWithoutImage = activeCategories.filter((category) => !normalizeText(category.image_url));
  const categoriesWithoutProducts = activeCategories.filter((category) => !productCategoryIds.has(category.id));
  const duplicateSlugs = duplicateValues(activeProducts, "slug");
  const duplicateSkus = duplicateValues(activeProducts, "sku");

  const pushIf = (condition, item, status, action) => {
    if (condition) findings.push({ item, status, action });
  };

  pushIf(productsWithoutCategory.length, "Productos sin rubro válido", String(productsWithoutCategory.length), "Asignar categoría activa.");
  pushIf(productsWithoutImage.length, "Productos sin foto", String(productsWithoutImage.length), "Cargar imagen real al bucket product-images.");
  pushIf(
    productsWithPlaceholderImage.length,
    "Productos con foto placeholder/banco",
    String(productsWithPlaceholderImage.length),
    "Reemplazar por foto real del producto o proveedor."
  );
  pushIf(
    productsWithInvalidImage.length,
    "Productos con host de imagen no permitido",
    String(productsWithInvalidImage.length),
    "Usar Supabase Storage, Cloudinary permitido o actualizar next.config.ts."
  );
  pushIf(productsWithoutDescription.length, "Productos con descripción débil", String(productsWithoutDescription.length), "Completar uso, presentación y recomendaciones.");
  pushIf(productsWithoutBrand.length, "Productos sin marca", String(productsWithoutBrand.length), "Cargar marca o proveedor.");
  pushIf(productsWithoutSku.length, "Productos sin SKU comercial", String(productsWithoutSku.length), "Definir SKU único.");
  pushIf(productsWithBadSlug.length, "Productos con slug no SEO", String(productsWithBadSlug.length), "Usar minúsculas, números y guiones.");
  pushIf(productsWithBadPrice.length, "Productos sin precio válido", String(productsWithBadPrice.length), "Cargar precio mayor a cero.");
  pushIf(productsWithoutStock.length, "Productos sin stock activo", String(productsWithoutStock.length), "Desactivar o reponer antes de campaña.");
  pushIf(lowStockProducts.length, "Productos bajo stock", String(lowStockProducts.length), "Reponer o revisar stock mínimo.");
  pushIf(categoriesWithoutDescription.length, "Rubros con descripción débil", String(categoriesWithoutDescription.length), "Agregar microcopy comercial.");
  pushIf(categoriesWithoutImage.length, "Rubros sin imagen", String(categoriesWithoutImage.length), "Agregar imagen real o mantener ícono como fallback.");
  pushIf(categoriesWithoutProducts.length, "Rubros sin productos activos", String(categoriesWithoutProducts.length), "Asignar productos o ocultar el rubro.");
  pushIf(duplicateSlugs.length, "Slugs duplicados", String(duplicateSlugs.length), "Unificar slugs para evitar rutas ambiguas.");
  pushIf(duplicateSkus.length, "SKUs duplicados", String(duplicateSkus.length), "Asignar SKUs únicos.");

  const ready =
    configured &&
    !errors.length &&
    activeProducts.length > 0 &&
    activeCategories.length > 0 &&
    !productsWithoutCategory.length &&
    !productsWithInvalidImage.length &&
    !productsWithBadSlug.length &&
    !productsWithBadPrice.length &&
    !duplicateSlugs.length &&
    !duplicateSkus.length;

  return {
    summary: {
      configured,
      ready,
      totalProducts: productCount ?? products.length,
      activeProducts: activeProducts.length,
      inactiveProducts: inactiveProducts.length,
      totalCategories: categoryCount ?? categories.length,
      activeCategories: activeCategories.length,
      inactiveCategories: inactiveCategories.length,
      featured: activeProducts.filter((product) => product.featured).length,
      offers: activeProducts.filter((product) => product.on_sale).length,
      totalStock: activeProducts.reduce((sum, product) => sum + Number(product.stock || 0), 0),
      maxPrice: Math.max(0, ...activeProducts.map((product) => Number(product.price || 0))),
      minPositivePrice: Math.min(...activeProducts.map((product) => Number(product.price || 0)).filter((price) => price > 0))
    },
    findings,
    details: {
      productsWithoutCategory,
      productsWithoutImage,
      productsWithPlaceholderImage,
      productsWithInvalidImage,
      productsWithoutDescription,
      productsWithoutStock,
      lowStockProducts,
      categoriesWithoutProducts,
      categoriesWithoutDescription,
      categoriesWithoutImage,
      duplicateSlugs,
      duplicateSkus
    }
  };
}

function productNames(rows) {
  return shortList(rows.map((row) => `${row.name || row.slug || row.id} (${row.sku || "sin SKU"})`));
}

function categoryNames(rows) {
  return shortList(rows.map((row) => `${row.name || row.slug || row.id}`));
}

function renderReport(catalog, analysis) {
  const { summary, findings, details } = analysis;
  const readiness = summary.ready ? "Apto para venta controlada" : "Requiere saneamiento comercial";
  const minPrice = Number.isFinite(summary.minPositivePrice) ? money(summary.minPositivePrice) : "-";

  return `# Auditoría de catálogo y contenido comercial FZAC

Fecha: ${today()}
URL objetivo: ${SITE_URL}
Entorno: ${process.env.NODE_ENV || "local"}
Modo: lectura segura desde Supabase, sin escrituras.

## Resumen ejecutivo

Estado: **${readiness}**

| Métrica | Valor |
| --- | ---: |
| Productos totales auditados | ${summary.totalProducts} |
| Productos activos | ${summary.activeProducts} |
| Productos inactivos | ${summary.inactiveProducts} |
| Categorías totales auditadas | ${summary.totalCategories} |
| Categorías activas | ${summary.activeCategories} |
| Categorías inactivas | ${summary.inactiveCategories} |
| Productos destacados | ${summary.featured} |
| Productos en oferta | ${summary.offers} |
| Stock total visible | ${summary.totalStock} |
| Precio mínimo activo | ${minPrice} |
| Precio máximo activo | ${money(summary.maxPrice)} |

## Hallazgos

${table(findings)}

## Detalle para carga comercial

### Productos sin rubro válido
${productNames(details.productsWithoutCategory)}

### Productos sin foto
${productNames(details.productsWithoutImage)}

### Productos con foto placeholder o banco
${productNames(details.productsWithPlaceholderImage)}

### Productos con imagen de host no permitido
${productNames(details.productsWithInvalidImage)}

### Productos con descripción débil
${productNames(details.productsWithoutDescription)}

### Productos sin stock activo
${productNames(details.productsWithoutStock)}

### Productos bajo stock
${productNames(details.lowStockProducts)}

### Rubros sin productos activos
${categoryNames(details.categoriesWithoutProducts)}

### Rubros con descripción débil
${categoryNames(details.categoriesWithoutDescription)}

### Rubros sin imagen propia
${categoryNames(details.categoriesWithoutImage)}

### Slugs duplicados
${shortList(details.duplicateSlugs)}

### SKUs duplicados
${shortList(details.duplicateSkus)}

## Criterio de producción

- No bloquear venta por rubros sin imagen si el ícono FZAC funciona como fallback.
- Sí bloquear campañas pagas si hay slugs/SKUs duplicados, precios inválidos, rutas sin categoría o imágenes con host no permitido.
- Las fotos de banco sirven para QA visual, pero conviene reemplazarlas por fotos reales antes de SEO/indexación.
- Una consulta real vacía no debe ser reemplazada por productos ficticios; el catálogo ya mantiene ese criterio.

## Próximo control manual

- Revisar los 10 productos más vendidos desde Admin > Productos.
- Confirmar precio, unidad, stock mínimo y foto real.
- Abrir cada rubro desde mobile y validar que el primer viewport muestre productos o un estado vacío claro.
- Al publicar dominio final, activar SEO indexing recién después de que el catálogo esté saneado.
`;
}

async function main() {
  const catalog = await loadCatalog();
  const analysis = analyze(catalog);
  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await fs.writeFile(REPORT_PATH, renderReport(catalog, analysis), "utf8");

  console.log(`Catalog audit: ${analysis.summary.ready ? "READY" : "NEEDS_ATTENTION"}`);
  console.log(`Products: ${analysis.summary.activeProducts} active / ${analysis.summary.totalProducts} total`);
  console.log(`Categories: ${analysis.summary.activeCategories} active / ${analysis.summary.totalCategories} total`);
  console.log(`Findings: ${analysis.findings.length}`);
  console.log(`Report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Catalog audit failed.");
  process.exitCode = 1;
});
