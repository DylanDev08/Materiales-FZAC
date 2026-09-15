import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const OUTPUT = "data/audits/product-content-sources.preview.json";
const USER_AGENT = "MaterialesFZACContentAudit/1.0 (+https://materiales-fzac-8xmp.onrender.com/)";
const MAX_DESCRIPTION_LENGTH = 360;

function loadEnvironment() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // The explicit validation below remains the single safe failure mode.
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
  return createClient(url.replace(/^['"]|['"]$/g, ""), key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function readAll(queryFactory, pageSize = 500) {
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await queryFactory().range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) return rows;
  }
}

function decodeHtml(value = "") {
  const decoded = String(value)
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#0?39;/gi, "'")
    .replace(/&(aacute|eacute|iacute|oacute|uacute|ntilde|uuml);/gi, (_, entity) => {
      const character = ({
        aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü"
      })[entity.toLowerCase()];
      return entity[0] === entity[0].toUpperCase() ? character.toUpperCase() : character;
    })
    .replace(/&reg;/gi, "®")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
  return /Ã.|Â./.test(decoded) ? Buffer.from(decoded, "latin1").toString("utf8") : decoded;
}

function plainText(value = "") {
  return decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<\/p>|<\/li>|<\/h\d>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/([.!?])\s*\1+/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^\s*descripci[oó]n\.?\s*/i, "")
    .trim();
}

function normalize(value = "") {
  return plainText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-AR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function conciseDescription(value) {
  const text = plainText(value);
  if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
  const bounded = text.slice(0, MAX_DESCRIPTION_LENGTH + 1);
  const sentenceEnd = Math.max(bounded.lastIndexOf(". "), bounded.lastIndexOf("; "));
  const wordEnd = bounded.lastIndexOf(" ");
  return bounded.slice(0, sentenceEnd >= 80 ? sentenceEnd + 1 : wordEnd).trim();
}

function extractDescription(html) {
  const productDescription = html.match(
    /<div\b[^>]*class=["'][^"']*\bproduct-description\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  )?.[1];
  if (productDescription) return conciseDescription(productDescription);

  const jsonLdDescription = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    })
    .find((entry) => entry?.["@type"] === "Product" && typeof entry.description === "string")?.description;
  return conciseDescription(jsonLdDescription ?? "");
}

function meaningfulDescription(description, productName, originalName) {
  const candidate = normalize(description);
  if (candidate.length < 20) return false;
  const names = [productName, originalName].map(normalize).filter(Boolean);
  if (names.some((name) => candidate === name)) return false;
  return !/^(comprar|compra) .+ (online|en linea)$/.test(candidate);
}

async function fetchCandidate(row) {
  if (!row.source_url) return { ...row, status: "PENDING_NO_SOURCE", candidate: null };
  try {
    const response = await fetch(row.source_url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) return { ...row, status: `SOURCE_HTTP_${response.status}`, candidate: null };
    const candidate = extractDescription(await response.text());
    if (!meaningfulDescription(candidate, row.product_name, row.original_name)) {
      return { ...row, status: "PENDING_NO_MEANINGFUL_DESCRIPTION", candidate: null };
    }
    return { ...row, status: "VERIFIED_CANDIDATE", candidate };
  } catch (error) {
    return {
      ...row,
      status: "SOURCE_ERROR",
      candidate: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function mapGently(rows) {
  const results = [];
  for (let index = 0; index < rows.length; index += 1) {
    results.push(await fetchCandidate(rows[index]));
    if (index + 1 < rows.length) await new Promise((resolve) => setTimeout(resolve, 180));
    if ((index + 1) % 20 === 0) console.log(`Fuentes revisadas: ${index + 1}/${rows.length}`);
  }
  return results;
}

async function main() {
  const db = supabaseClient();
  const [products, suppliers, sources] = await Promise.all([
    readAll(() => db.from("products")
      .select("id,name,sku,description,image_url,supplier_id,availability_status,stock")
      .order("name")),
    readAll(() => db.from("suppliers").select("id,code,name").order("name")),
    readAll(() => db.from("product_supplier_sources")
      .select("product_id,supplier_id,source_url,source_image_url,original_name")
      .order("product_id"))
  ]);
  const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier]));
  const sourceByProductId = new Map(sources.map((source) => [source.product_id, source]));
  const missingDescription = products.filter((product) => !String(product.description ?? "").trim());
  const candidates = await mapGently(missingDescription.map((product) => {
    const source = sourceByProductId.get(product.id);
    const supplier = supplierById.get(product.supplier_id);
    return {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      supplier: supplier?.name ?? null,
      supplier_code: supplier?.code ?? null,
      original_name: source?.original_name ?? null,
      source_url: source?.source_url ?? null
    };
  }));
  const missingImage = products.filter((product) => !String(product.image_url ?? "").trim());
  const missingSupplier = products.filter((product) => !product.supplier_id);
  const output = {
    generated_at: new Date().toISOString(),
    mode: "READ_ONLY_PREVIEW",
    summary: {
      products: products.length,
      missing_description: missingDescription.length,
      verified_description_candidates: candidates.filter((row) => row.status === "VERIFIED_CANDIDATE").length,
      missing_image: missingImage.length,
      missing_supplier: missingSupplier.length
    },
    description_candidates: candidates,
    unresolved_assets: products
      .filter((product) => !product.supplier_id || !String(product.image_url ?? "").trim())
      .map((product) => ({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        missing_image: !String(product.image_url ?? "").trim(),
        missing_supplier: !product.supplier_id,
        supplier: supplierById.get(product.supplier_id)?.name ?? null,
        source_url: sourceByProductId.get(product.id)?.source_url ?? null,
        source_image_url: sourceByProductId.get(product.id)?.source_image_url ?? null
      }))
  };
  await mkdir("data/audits", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT, summary: output.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
