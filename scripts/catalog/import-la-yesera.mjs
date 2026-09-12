import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { storefrontCategorySlug } from "./sync-storefront-taxonomy.mjs";

const SOURCE = "La Yesera Rosarina";
const SOURCE_CATEGORY_URL = "https://tienda.layeserarosarina.com.ar/construccion-en-seco/";
const SOURCE_CATALOG_URL = "https://tienda.layeserarosarina.com.ar/productos/";
const OUTPUT_PATH = "data/imports/la-yesera-construccion-en-seco.preview.json";
const USER_AGENT = "MaterialesFZACCatalogAudit/1.0 (+https://materiales-fzac-8xmp.onrender.com/)";
const MAX_PAGES = 20;
const PAGE_SIZE = 12;
const APPLY = process.argv.includes("--apply");
const CATEGORY_CHILDREN = [
  ["Puertas", "puertas"],
  ["Cielorraso desmontable", "cielorraso-desmontable"],
  ["PVC", "pvc"],
  ["Acústica", "acustica"],
  ["Molduras", "molduras"]
];

function decodeHtml(value = "") {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#039;", "'")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/\bdrywall\b/g, "durlock")
    .replace(/\bplacas\b/g, "placa")
    .replace(/\bmts?\b|\bmetros?\b/g, "m")
    .replace(/,/g, ".")
    .replace(/\s*x\s*/g, "x")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value).replaceAll(".", "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 170);
}

export function tokenSimilarity(left, right) {
  const a = new Set(normalizeText(left).split(" ").filter(Boolean));
  const b = new Set(normalizeText(right).split(" ").filter(Boolean));
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function publicImageUrl(value) {
  if (!value) return null;
  const url = value.startsWith("//") ? `https:${value}` : value;
  return url.includes("/no-photo-") ? null : url;
}

function brandFromPublicName(name) {
  const publicBrands = ["Durlock", "Isover", "Knauf", "Armstrong", "Andina"];
  return publicBrands.find((brand) => new RegExp(`\\b${brand}\\b`, "i").test(name)) ?? null;
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Fuente respondió HTTP ${response.status}: ${url}`);
  return response.text();
}

export function isAroProduct(product = {}) {
  const searchable = [
    product.original_name,
    product.name,
    product.slug,
    product.category,
    product.subcategory,
    JSON.stringify(product.metadata ?? {}),
    JSON.stringify(product.specifications ?? {})
  ].filter(Boolean).join(" ");
  return /(^|\s)aros?(\s|$)/.test(normalizeText(searchable));
}

export function marginPercent(product = {}) {
  return isAroProduct(product) ? 10 : 20;
}

export function salePrice(sourcePrice, product = {}) {
  return Math.round(sourcePrice * (1 + marginPercent(product) / 100));
}

export function isSupplementalDryProduct(product = {}) {
  const name = normalizeText(product.original_name ?? product.name ?? "");
  return isAroProduct(product) || /(^|\s)(durlock|superboard|siding|pgc|pgu)(\s|$)/.test(name);
}

export function parseProducts(html, subcategoryById) {
  const starts = [...html.matchAll(/<div class="js-item-product[^>]*data-product-id="(\d+)"/g)];
  return starts.flatMap((match, index) => {
    const sourceProductId = match[1];
    const end = starts[index + 1]?.index ?? html.indexOf('<div id="js-infinite-scroll-spinner"', match.index);
    const item = html.slice(match.index, end > match.index ? end : undefined);
    const variantsAttribute = item.match(/data-variants="([^"]+)"/)?.[1];
    const link = item.match(/<a href="(https:\/\/tienda\.layeserarosarina\.com\.ar\/productos\/[^"]+)" title="([^"]+)"/);
    if (!variantsAttribute || !link) return [];

    let variants;
    try {
      variants = JSON.parse(decodeHtml(variantsAttribute));
    } catch {
      return [];
    }
    const variant = variants.find((candidate) => candidate?.is_visible !== false) ?? variants[0];
    const originalPrice = Number(variant?.price_number);
    const originalName = decodeHtml(link[2]).trim();
    if (!originalName || !Number.isFinite(originalPrice) || originalPrice <= 0) return [];

    const sourceUrl = decodeHtml(link[1]);
    const product = {
      source: SOURCE,
      source_product_id: sourceProductId,
      source_url: sourceUrl,
      original_name: originalName,
      original_price: originalPrice,
      source_image_url: publicImageUrl(variant?.image_url),
      image_url: null,
      image_status: "AUTHORIZED_PENDING_STORAGE_SYNC",
      brand: brandFromPublicName(originalName),
      category: "Construcción en seco",
      subcategory: subcategoryById.get(sourceProductId) ?? "General",
      source_sku: variant?.sku ? String(variant.sku) : null,
      import_sku: `LYR-${sourceProductId}`,
      slug: slugify(originalName),
      unit: "unidad",
      stock: null,
      availability_status: "CONSULT",
      description: null,
      specifications: {}
    };
    const appliedMargin = marginPercent(product);
    return [{
      ...product,
      margin_percent: appliedMargin,
      sale_price: salePrice(originalPrice, product),
      target_category_slug: storefrontCategorySlug(originalName)
    }];
  });
}

async function discoverSubcategories() {
  const byId = new Map();
  for (const [label, slug] of CATEGORY_CHILDREN) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const html = await fetchHtml(`${SOURCE_CATEGORY_URL}${slug}/?page=${page}`);
      const ids = [...html.matchAll(/data-product-id="(\d+)"/g)].map((match) => match[1]);
      [...new Set(ids)].forEach((id) => byId.set(id, label));
      if (new Set(ids).size < PAGE_SIZE) break;
    }
  }
  return byId;
}

async function discoverProducts(subcategoryById) {
  const categoryRows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const html = await fetchHtml(`${SOURCE_CATEGORY_URL}?page=${page}`);
    const pageRows = parseProducts(html, subcategoryById);
    if (!pageRows.length) break;
    categoryRows.push(...pageRows.map((row) => ({ ...row, source_scope: "CONSTRUCCION_EN_SECO" })));
    if (pageRows.length < PAGE_SIZE) break;
  }

  const supplementalRows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const html = await fetchHtml(`${SOURCE_CATALOG_URL}?page=${page}`);
    const pageRows = parseProducts(html, subcategoryById);
    if (!pageRows.length) break;
    supplementalRows.push(...pageRows
      .filter(isSupplementalDryProduct)
      .map((row) => ({ ...row, source_scope: "CATALOG_RELATED" })));
    if (pageRows.length < PAGE_SIZE) break;
  }

  const uniqueRows = new Map();
  for (const row of [...categoryRows, ...supplementalRows]) {
    if (!uniqueRows.has(row.source_product_id)) uniqueRows.set(row.source_product_id, row);
  }
  return {
    rows: [...uniqueRows.values()],
    categoryCount: new Set(categoryRows.map((row) => row.source_product_id)).size,
    supplementalCount: [...uniqueRows.values()].filter((row) => row.source_scope === "CATALOG_RELATED").length
  };
}

function supabaseClient() {
  const requiredNames = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || (!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_URL && !process.env.DATABASE_URL)) {
    for (const name of requiredNames) {
      if (!process.env[name]) delete process.env[name];
    }
    try {
      process.loadEnvFile(".env");
    } catch {
      // The explicit error below remains the single safe failure mode.
    }
  }
  const databaseProjectRef = process.env.DATABASE_URL?.match(/db\.([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"] || process.env.SUPABASE_URL || (databaseProjectRef ? `https://${databaseProjectRef}.supabase.co` : ""))
    .replace(/^['"]|['"]$/g, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configuración Supabase server-side.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function loadFzacState(db) {
  let productQuery = await db.from("products").select("id,name,slug,sku,brand,subcategory,price,stock,image_url,supplier_id,availability_status");
  if (productQuery.error?.message.includes("supplier_id") || productQuery.error?.message.includes("availability_status")) {
    productQuery = await db.from("products").select("id,name,slug,sku,brand,subcategory,price,stock,image_url");
  }
  const [{ data: categories, error: categoryError }, { data: supplier, error: supplierError }] = await Promise.all([
    db.from("categories").select("id,slug").in("slug", ["construccion-en-seco", "steel-framing", "ferreteria"]),
    db.from("suppliers").select("id").eq("code", "LA-YESERA-ROSARINA").single()
  ]);
  if (productQuery.error) throw productQuery.error;
  if (categoryError || supplierError) throw categoryError || supplierError;
  const sourceQuery = await db.from("product_supplier_sources")
    .select("product_id,supplier_id,source_product_id,source_url,source_sku,original_price")
    .eq("supplier_id", supplier.id);
  if (sourceQuery.error) throw sourceQuery.error;
  return {
    products: productQuery.data ?? [],
    categoryBySlug: new Map((categories ?? []).map((category) => [category.slug, category.id])),
    supplierId: supplier.id,
    sources: sourceQuery.data ?? []
  };
}

function errorMessage(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    return [error.message, error.details, error.hint, error.code].filter(Boolean).join(" | ") || JSON.stringify(error);
  }
  return String(error);
}

export function classify(rows, state) {
  const sourceByExternalId = new Map(state.sources.map((source) => [source.source_product_id, source]));
  const sourceByUrl = new Map(state.sources.filter((source) => source.source_url).map((source) => [source.source_url, source]));
  const sourceBySku = new Map(state.sources.filter((source) => source.source_sku).map((source) => [source.source_sku, source]));
  return rows.map((row) => {
    const source = sourceByExternalId.get(row.source_product_id)
      ?? sourceByUrl.get(row.source_url)
      ?? (row.source_sku ? sourceBySku.get(row.source_sku) : null);
    if (source) {
      const reason = source.source_product_id === row.source_product_id
        ? "source_product_id"
        : source.source_url === row.source_url ? "source_url" : "source_sku";
      return { ...row, decision: "UPDATE_IMPORTED", existing_product_id: source.product_id, duplicate_reasons: [reason] };
    }

    const candidates = state.products.flatMap((product) => {
      const reasons = [];
      if (product.sku === row.source_sku || product.sku === row.import_sku) reasons.push("sku");
      if (product.slug === row.slug) reasons.push("slug");
      if (normalizeText(product.name) === normalizeText(row.original_name)) reasons.push("normalized_name");
      const similarity = tokenSimilarity(product.name, row.original_name);
      if (similarity >= 0.72) reasons.push(`name_similarity:${similarity.toFixed(2)}`);
      return reasons.length ? [{ id: product.id, name: product.name, reasons }] : [];
    });
    return {
      ...row,
      decision: candidates.some((candidate) => candidate.reasons.some((reason) => !reason.startsWith("name_similarity")))
        ? "SKIP_DUPLICATE"
        : candidates.length ? "REVIEW_POTENTIAL_DUPLICATE" : "INSERT",
      duplicate_candidates: candidates
    };
  });
}

async function upsertSuppliers(db) {
  const rows = [
    { code: "LA-YESERA-ROSARINA", name: "Yesera Rosarina", active: true },
    { code: "URBE-SRL", name: "Urbe SRL", active: true },
    { code: "MAQUINARIA-SORRENTOS", name: "Maquinaria Sorrentos", active: true }
  ];
  const { data, error } = await db.from("suppliers").upsert(rows, { onConflict: "code" }).select("id,code,name");
  if (error) throw error;
  return data ?? [];
}

async function applyImport(db, preview, state) {
  const suppliers = await upsertSuppliers(db);
  const supplier = suppliers.find((item) => item.code === "LA-YESERA-ROSARINA");
  if (!supplier) throw new Error("No se pudo registrar La Yesera Rosarina.");
  const result = { inserted: [], updated: [], skipped: [], errors: [] };

  for (const row of preview.products) {
    try {
      if (row.decision === "SKIP_DUPLICATE" || row.decision === "REVIEW_POTENTIAL_DUPLICATE") {
        result.skipped.push({ source_product_id: row.source_product_id, name: row.original_name, reason: row.decision });
        continue;
      }
      const productPayload = {
        name: row.original_name,
        slug: row.slug,
        sku: row.import_sku,
        description: "",
        category_id: state.categoryBySlug.get(row.target_category_slug),
        subcategory: row.subcategory,
        brand: row.brand ?? "Sin marca informada",
        price: row.sale_price,
        stock: 0,
        stock_minimum: 0,
        unit: row.unit,
        image_url: "",
        gallery: [],
        specifications: row.specifications,
        featured: false,
        on_sale: false,
        active: true,
        supplier_id: supplier.id,
        availability_status: "CONSULT"
      };

      let product;
      if (row.decision === "UPDATE_IMPORTED") {
        const { data, error } = await db.from("products")
          // Preserve any stock and availability decision recorded by FZAC
          // after the initial import while refreshing source-linked prices.
          .update({
            price: row.sale_price,
            supplier_id: supplier.id,
            category_id: state.categoryBySlug.get(row.target_category_slug),
            updated_at: new Date().toISOString()
          })
          .eq("id", row.existing_product_id).select("id,name,price").single();
        if (error) throw error;
        product = data;
        result.updated.push(product);
      } else {
        const { data, error } = await db.from("products").insert(productPayload).select("id,name,price").single();
        if (error) throw error;
        product = data;
        result.inserted.push(product);
      }

      const { error: provenanceError } = await db.from("product_supplier_sources").upsert({
        product_id: product.id,
        supplier_id: supplier.id,
        source: row.source,
        source_product_id: row.source_product_id,
        source_url: row.source_url,
        source_image_url: row.source_image_url,
        source_sku: row.source_sku,
        original_name: row.original_name,
        original_price: row.original_price,
        margin_percent: row.margin_percent,
        checked_at: new Date().toISOString()
      }, { onConflict: "product_id" });
      if (provenanceError) throw provenanceError;
    } catch (error) {
      result.errors.push({ source_product_id: row.source_product_id, name: row.original_name, error: errorMessage(error) });
    }
  }
  return { suppliers, ...result };
}

async function main() {
  const db = supabaseClient();
  const subcategoryById = await discoverSubcategories();
  const discovery = await discoverProducts(subcategoryById);
  const sourceRows = discovery.rows;
  const state = await loadFzacState(db);
  const products = classify(sourceRows, state);
  const preview = {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    source_category_url: SOURCE_CATEGORY_URL,
    source_requests: "Bounded Construcción en Seco, child-category and full-catalog pagination; supplemental rows require an explicit dry-construction product signal.",
    pricing_rule: "Math.round(original_price * 1.20), except products clearly identified as aro/aros: Math.round(original_price * 1.10)",
    image_policy: "El propietario de FZAC autorizó el uso comercial. La copia optimizada a Storage se ejecuta con catalog:la-yesera:images:apply; no se permite hotlink permanente.",
    summary: {
      found: products.length,
      category_found: discovery.categoryCount,
      supplemental_related: discovery.supplementalCount,
      margin_20: products.filter((row) => row.margin_percent === 20).length,
      margin_10_aros: products.filter((row) => row.margin_percent === 10).length,
      insert: products.filter((row) => row.decision === "INSERT").length,
      update_imported: products.filter((row) => row.decision === "UPDATE_IMPORTED").length,
      skip_duplicate: products.filter((row) => row.decision === "SKIP_DUPLICATE").length,
      review_potential_duplicate: products.filter((row) => row.decision === "REVIEW_POTENTIAL_DUPLICATE").length
    },
    products
  };

  await mkdir("data/imports", { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT_PATH, summary: preview.summary }, null, 2));

  if (APPLY) {
    if (products.length < 1) throw new Error("Dataset vacío: importación cancelada.");
    const result = await applyImport(db, preview, state);
    console.log(JSON.stringify({ applied: true, ...result }, null, 2));
    if (result.errors.length) process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await main();
