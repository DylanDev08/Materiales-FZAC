import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { storefrontCategorySlug } from "./sync-storefront-taxonomy.mjs";

const SOURCE = "La Yesera Rosarina";
const SOURCE_CATEGORY_URL = "https://tienda.layeserarosarina.com.ar/construccion-en-seco/";
const SOURCE_STEEL_FRAMING_URL = "https://tienda.layeserarosarina.com.ar/steel-framing/";
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
    .replace(/(\d)\s*x\s*(?=\d)/g, "$1x")
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
  const sourcePrice = Number(product.original_price ?? product.source_price ?? product.price ?? 0);
  if (!Number.isFinite(sourcePrice) || sourcePrice <= 0) return 0;
  // Commercial policy: Yesera products may carry at most 5% over the verified source price.
  return 5;
}

export function salePrice(sourcePrice, product = {}) {
  const price = Number(sourcePrice);
  if (!Number.isFinite(price) || price <= 0) throw new Error("Precio proveedor inválido.");
  return Math.round(price * (1 + marginPercent({ ...product, original_price: price }) / 100));
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

// Remaining import/apply helpers intentionally preserve existing behavior below this point.
