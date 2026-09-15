import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const SOURCE = "Universo Pinturas SRL Rosario";
const SUPPLIER_CODE = "UNIVERSO-PINTURAS-SRL";
const SOURCE_CATEGORY_URL = "https://www.tiendauniverso.com.ar/pinturas";
const SOURCE_API_URL = "https://www.tiendauniverso.com.ar/api/catalog_system/pub/products/search/pinturas";
const OUTPUT_PATH = "data/imports/universo-pinturas.preview.json";
const USER_AGENT = "MaterialesFZACCatalogAudit/1.0 (+https://materiales-fzac-8xmp.onrender.com/)";
const PAGE_SIZE = 50;
const MAX_PRODUCTS = 2500;
const APPLY = process.argv.includes("--apply");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/,/g, ".")
    .replace(/(\d)\s*x\s*(?=\d)/g, "$1x")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function slugify(value) {
  return normalizeText(value).replaceAll(".", "-").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function absoluteHttpsUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function sourceSubcategory(product) {
  const paths = Array.isArray(product.categories) ? product.categories : [];
  const pieces = String(paths[0] ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return pieces[1] || "Pinturas";
}

export function commercialScope(product = {}) {
  const searchable = normalizeText([
    product.original_name,
    product.subcategory,
    product.category,
    product.description
  ].filter(Boolean).join(" "));
  if (/(^| )(piletas?|hogar|jardin|automotor|muebles?|megaofertas?)( |$)/.test(searchable)) return "REVIEW";
  if (/(^| )(latex|esmalte|pintura|impermeabilizante|membrana|enduido|sellador|barniz|revestimiento|fijador|masilla|diluyente|aguarras|rodillo|pincel|brocha|lija|cinta|espatula|aerosol|antioxido)( |$)/.test(searchable)) return "INCLUDE";
  return "REVIEW";
}

function publicSpecifications(product, item) {
  const allowed = new Set(["Capacidad", "COLOR", "DILUCION", "TERMINACION", "Tipo de Diluyente", "TIPO DE EPOXI", "Sub-Categoría"]);
  const specifications = {};
  for (const groupName of Array.isArray(product.allSpecifications) ? product.allSpecifications : []) {
    if (!allowed.has(groupName)) continue;
    const values = product[groupName];
    if (Array.isArray(values) && values.length) specifications[groupName] = values.map(String).join(", ").slice(0, 240);
  }
  if (item.ean) specifications.EAN = String(item.ean);
  if (item.referenceId?.[0]?.Value) specifications.Referencia = String(item.referenceId[0].Value);
  return specifications;
}

function commercialOffer(item) {
  const offers = (Array.isArray(item.sellers) ? item.sellers : [])
    .map((seller) => seller?.commertialOffer)
    .filter((offer) => Number.isFinite(Number(offer?.Price)) && Number(offer.Price) > 0);
  return offers.sort((left, right) => Number(left.Price) - Number(right.Price))[0] ?? null;
}

function parseProduct(product) {
  return (Array.isArray(product.items) ? product.items : []).flatMap((item) => {
    const offer = commercialOffer(item);
    if (!offer) return [];
    const sourceProductId = `${product.productId}:${item.itemId}`;
    const originalName = String(item.nameComplete || product.productName || "").trim();
    const sourceUrl = absoluteHttpsUrl(product.link);
    const imageUrls = (Array.isArray(item.images) ? item.images : [])
      .map((image) => absoluteHttpsUrl(image?.imageUrl))
      .filter(Boolean);
    const originalPrice = Number(Number(offer.Price).toFixed(2));
    if (!originalName || !sourceUrl || !originalPrice) return [];
    const parsed = {
      source: SOURCE,
      source_product_id: sourceProductId,
      source_url: sourceUrl,
      original_name: originalName,
      original_price: originalPrice,
      sale_price: originalPrice,
      margin_percent: 0,
      compare_price: null,
      source_image_url: imageUrls[0] ?? null,
      source_gallery_urls: imageUrls.slice(0, 6),
      source_sku: String(item.itemId),
      import_sku: `UNV-${item.itemId}`,
      slug: slugify(originalName),
      brand: String(product.brand || "Sin marca informada").trim(),
      category: "Pintura e impermeabilización",
      target_category_slug: "pintura-impermeabilizacion",
      subcategory: sourceSubcategory(product),
      description: stripHtml(product.description || product.metaTagDescription || ""),
      unit: String(item.measurementUnit || "unidad").toLowerCase() === "un" ? "unidad" : String(item.measurementUnit || "unidad"),
      specifications: publicSpecifications(product, item),
      stock: null,
      availability_status: "CONSULT",
      image_status: "AUTHORIZED_PENDING_STORAGE_SYNC"
    };
    return [{ ...parsed, commercial_scope: commercialScope(parsed) }];
  });
}

async function fetchSourceProducts() {
  const rows = [];
  let total = null;
  for (let from = 0; from < MAX_PRODUCTS && (total === null || from < total); from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    let response;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      response = await fetch(`${SOURCE_API_URL}?_from=${from}&_to=${to}`, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000)
      });
      if (response.ok || (response.status !== 429 && response.status < 500)) break;
      await sleep(750 * (attempt + 1));
    }
    if (!response.ok) throw new Error(`Universo respondió HTTP ${response.status} para rango ${from}-${to}`);
    const resourceRange = response.headers.get("resources") ?? response.headers.get("content-range") ?? "";
    const parsedTotal = Number(resourceRange.match(/\/(\d+)$/)?.[1]);
    if (Number.isFinite(parsedTotal)) total = parsedTotal;
    const products = await response.json();
    if (!Array.isArray(products) || products.length === 0) break;
    rows.push(...products.flatMap(parseProduct));
    if (products.length < PAGE_SIZE) break;
    await sleep(250);
  }
  return { rows, reportedTotal: total };
}

function loadEnvironment() {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]) delete process.env[name];
  }
  try {
    process.loadEnvFile(".env");
  } catch {
    // The validation below remains the single safe failure mode.
  }
}

function supabaseClient() {
  loadEnvironment();
  const projectRef = process.env.DATABASE_URL?.match(/db\.([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"]
    || process.env.SUPABASE_URL
    || (projectRef ? `https://${projectRef}.supabase.co` : "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configuración Supabase server-side.");
  return createClient(url.replace(/^['"]|['"]$/g, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function readAll(queryFactory, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

async function loadFzacState(db) {
  const [products, categoryResult, supplierResult] = await Promise.all([
    readAll(() => db.from("products").select("id,name,slug,sku,price,supplier_id,image_url,stock,availability_status")),
    db.from("categories").select("id,slug").eq("slug", "pintura-impermeabilizacion").single(),
    db.from("suppliers").select("id,code").eq("code", SUPPLIER_CODE).maybeSingle()
  ]);
  if (categoryResult.error || supplierResult.error) throw categoryResult.error || supplierResult.error;
  let sources = [];
  if (supplierResult.data?.id) {
    sources = await readAll(() => db.from("product_supplier_sources")
      .select("product_id,source_product_id,source_url,source_sku")
      .eq("supplier_id", supplierResult.data.id));
  }
  return { products, category: categoryResult.data, supplier: supplierResult.data, sources };
}

function classify(sourceRows, state) {
  const sourceById = new Map(state.sources.map((row) => [row.source_product_id, row]));
  const productById = new Map(state.products.map((row) => [row.id, row]));
  const existingSku = new Map(state.products.map((row) => [String(row.sku).toLowerCase(), row]));
  const existingSlug = new Map(state.products.map((row) => [row.slug, row]));
  const existingName = new Map(state.products.map((row) => [normalizeText(row.name), row]));
  const usedSlugs = new Set(state.products.map((row) => row.slug));
  const usedNames = new Map();

  return sourceRows.map((sourceRow) => {
    const existingSource = sourceById.get(sourceRow.source_product_id);
    if (existingSource) {
      const current = productById.get(existingSource.product_id);
      const currentPrice = current ? Number(current.price) : null;
      return {
        ...sourceRow,
        decision: "UPDATE_IMPORTED",
        existing_product_id: existingSource.product_id,
        current_fzac_price: currentPrice,
        price_difference: currentPrice === null ? null : sourceRow.sale_price - currentPrice,
        duplicate_reasons: ["source_product_id"]
      };
    }
    const skuMatch = existingSku.get(sourceRow.import_sku.toLowerCase());
    if (skuMatch && state.supplier?.id && skuMatch.supplier_id === state.supplier.id) {
      return { ...sourceRow, decision: "RECOVER_IMPORTED", existing_product_id: skuMatch.id, duplicate_reasons: ["import_sku"] };
    }
    const baseSlug = sourceRow.slug || `universo-${sourceRow.source_sku}`;
    const sameSourceNameCount = usedNames.get(normalizeText(sourceRow.original_name)) ?? 0;
    usedNames.set(normalizeText(sourceRow.original_name), sameSourceNameCount + 1);
    const stableSlug = usedSlugs.has(baseSlug) || sameSourceNameCount > 0 ? `${baseSlug}-${sourceRow.source_sku}`.slice(0, 170) : baseSlug;
    usedSlugs.add(stableSlug);
    const exactMatches = [
      skuMatch ? { product: skuMatch, reason: "sku" } : null,
      existingSlug.get(baseSlug) ? { product: existingSlug.get(baseSlug), reason: "slug" } : null,
      existingName.get(normalizeText(sourceRow.original_name)) ? { product: existingName.get(normalizeText(sourceRow.original_name)), reason: "normalized_name" } : null
    ].filter(Boolean);
    return {
      ...sourceRow,
      slug: stableSlug,
      decision: exactMatches.length
        ? "SKIP_DUPLICATE"
        : sourceRow.commercial_scope === "INCLUDE" ? "INSERT" : "REVIEW_CATEGORY",
      duplicate_candidates: exactMatches.map((match) => ({ id: match.product.id, name: match.product.name, reason: match.reason }))
    };
  });
}

function productPayload(row, categoryId, supplierId) {
  return {
    name: row.original_name,
    slug: row.slug,
    sku: row.import_sku,
    description: row.description,
    category_id: categoryId,
    subcategory: row.subcategory,
    brand: row.brand,
    price: row.sale_price,
    compare_price: null,
    stock: 0,
    stock_minimum: 0,
    unit: row.unit,
    image_url: "",
    gallery: [],
    specifications: row.specifications,
    featured: false,
    on_sale: false,
    active: true,
    supplier_id: supplierId,
    availability_status: "CONSULT",
    updated_at: new Date().toISOString()
  };
}

function chunks(rows, size) {
  return Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, (index + 1) * size));
}

async function applyImport(db, preview, state) {
  const supplierResult = await db.from("suppliers")
    .upsert({ code: SUPPLIER_CODE, name: SOURCE, active: true }, { onConflict: "code" })
    .select("id,code,name")
    .single();
  if (supplierResult.error) throw supplierResult.error;
  const supplier = supplierResult.data;
  const result = { inserted: 0, updated: 0, recovered: 0, skipped: 0, errors: [] };
  const productIdBySku = new Map();
  const insertRows = preview.products.filter((row) => row.decision === "INSERT" || row.decision === "RECOVER_IMPORTED");

  for (const batch of chunks(insertRows, 75)) {
    const response = await db.from("products")
      .upsert(batch.map((row) => productPayload(row, state.category.id, supplier.id)), { onConflict: "sku" })
      .select("id,sku");
    if (response.error) throw response.error;
    for (const product of response.data ?? []) productIdBySku.set(product.sku, product.id);
    result.inserted += batch.filter((row) => row.decision === "INSERT").length;
    result.recovered += batch.filter((row) => row.decision === "RECOVER_IMPORTED").length;
  }

  for (const row of preview.products.filter((item) => item.decision === "UPDATE_IMPORTED" && item.price_difference !== 0)) {
    const current = state.products.find((product) => product.id === row.existing_product_id);
    const response = await db.from("products").update({
      price: row.sale_price,
      compare_price: null,
      on_sale: false,
      category_id: state.category.id,
      supplier_id: supplier.id,
      updated_at: new Date().toISOString()
    }).eq("id", row.existing_product_id);
    if (response.error) {
      result.errors.push({ source_product_id: row.source_product_id, error: response.error.message });
      continue;
    }
    productIdBySku.set(row.import_sku, current?.id ?? row.existing_product_id);
    result.updated += 1;
  }

  const provenance = preview.products.flatMap((row) => {
    if (row.decision === "SKIP_DUPLICATE" || row.decision === "REVIEW_CATEGORY") {
      result.skipped += 1;
      return [];
    }
    const productId = row.existing_product_id || productIdBySku.get(row.import_sku);
    if (!productId) {
      result.errors.push({ source_product_id: row.source_product_id, error: "No se resolvió product_id" });
      return [];
    }
    return [{
      product_id: productId,
      supplier_id: supplier.id,
      source: SOURCE,
      source_product_id: row.source_product_id,
      source_url: row.source_url,
      source_image_url: row.source_image_url,
      source_sku: row.source_sku,
      original_name: row.original_name,
      original_price: row.original_price,
      margin_percent: 0,
      checked_at: new Date().toISOString()
    }];
  });
  for (const batch of chunks(provenance, 100)) {
    const response = await db.from("product_supplier_sources").upsert(batch, { onConflict: "product_id" });
    if (response.error) throw response.error;
  }
  return { supplier, ...result };
}

async function main() {
  const db = supabaseClient();
  const [{ rows, reportedTotal }, state] = await Promise.all([fetchSourceProducts(), loadFzacState(db)]);
  const products = classify(rows, state);
  const preview = {
    generated_at: new Date().toISOString(),
    source: SOURCE,
    source_category_url: SOURCE_CATEGORY_URL,
    source_api: SOURCE_API_URL,
    source_requests: `Paginación pública acotada a ${PAGE_SIZE} productos por solicitud, pausa de 250 ms y máximo ${MAX_PRODUCTS}.`,
    pricing_rule: "Precio FZAC igual al precio público vigente de Universo. Margen 0% hasta que FZAC apruebe una regla comercial específica.",
    stock_rule: "La cantidad expuesta por VTEX no se importa porque puede estar limitada/capada. FZAC usa stock 0 y CONSULT hasta validación propia.",
    image_policy: "Imágenes autorizadas por el propietario de FZAC; se copian optimizadas a Storage propio antes de publicar la categoría.",
    summary: {
      source_reported_products: reportedTotal,
      priced_skus_found: products.length,
      insert: products.filter((row) => row.decision === "INSERT").length,
      update_imported: products.filter((row) => row.decision === "UPDATE_IMPORTED").length,
      price_changes: products.filter((row) => row.decision === "UPDATE_IMPORTED" && row.price_difference !== 0).length,
      price_unchanged: products.filter((row) => row.decision === "UPDATE_IMPORTED" && row.price_difference === 0).length,
      recover_imported: products.filter((row) => row.decision === "RECOVER_IMPORTED").length,
      skip_duplicate: products.filter((row) => row.decision === "SKIP_DUPLICATE").length,
      review_category: products.filter((row) => row.decision === "REVIEW_CATEGORY").length,
      scope_include: products.filter((row) => row.commercial_scope === "INCLUDE").length,
      scope_review: products.filter((row) => row.commercial_scope === "REVIEW").length,
      missing_source_image: products.filter((row) => !row.source_image_url).length,
      stock_imported: 0,
      availability: "CONSULT",
      margin_percent: 0
    },
    products
  };
  await mkdir("data/imports", { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT_PATH, summary: preview.summary }, null, 2));

  if (APPLY) {
    if (!products.length) throw new Error("Dataset vacío: importación cancelada.");
    const result = await applyImport(db, preview, state);
    console.log(JSON.stringify({ applied: true, ...result }, null, 2));
    if (result.errors.length) process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export { classify, commercialOffer, normalizeText, parseProduct };
