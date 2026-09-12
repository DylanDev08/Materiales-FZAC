import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const OUTPUT = "data/imports/la-yesera-production-audit.json";

function loadEnvironment() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Validated without exposing environment values below.
  }
}

function client() {
  loadEnvironment();
  const projectRef = process.env.DATABASE_URL?.match(/db\.([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"]
    || process.env.SUPABASE_URL
    || (projectRef ? `https://${projectRef}.supabase.co` : "")
  ).replace(/^['"]|['"]$/g, "");
  if (!url || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Falta configuración Supabase server-side.");
  return createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalized(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bdrywall\b/g, "durlock")
    .replace(/,/g, ".")
    .replace(/\s*x\s*/g, "x")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function duplicateKeys(rows, key) {
  return [...Map.groupBy(rows, key).entries()]
    .filter(([value, matches]) => value && matches.length > 1)
    .map(([value, matches]) => ({ value, count: matches.length }));
}

async function main() {
  const db = client();
  const { data, error } = await db
    .from("product_supplier_sources")
    .select("source_product_id,source_url,original_name,original_price,margin_percent,products!inner(name,slug,sku,price,stock,availability_status,image_url,categories(name,slug),suppliers(name,code))")
    .eq("source", "La Yesera Rosarina")
    .order("original_name")
    .limit(1000);
  if (error) throw error;

  const products = (data ?? []).map((row) => ({
    source_product_id: row.source_product_id,
    source_url: row.source_url,
    original_name: row.original_name,
    original_price: Number(row.original_price),
    margin_percent: Number(row.margin_percent),
    sale_price: Number(row.products.price),
    sku: row.products.sku,
    slug: row.products.slug,
    category: row.products.categories?.name ?? null,
    category_slug: row.products.categories?.slug ?? null,
    stock: Number(row.products.stock),
    availability_status: row.products.availability_status,
    image_url: row.products.image_url,
    supplier: row.products.suppliers?.name ?? null
  }));

  const duplicates = {
    source_product_id: duplicateKeys(products, (row) => row.source_product_id),
    sku: duplicateKeys(products, (row) => row.sku),
    slug: duplicateKeys(products, (row) => row.slug),
    normalized_name: duplicateKeys(products, (row) => normalized(row.original_name))
  };
  const summary = {
    products: products.length,
    exact_duplicates: Object.values(duplicates).reduce((total, rows) => total + rows.length, 0),
    invalid_margin: products.filter((row) => {
      const allowedMargin = row.margin_percent === 10 || row.margin_percent === 20;
      return !allowedMargin || row.sale_price !== Math.round(row.original_price * (1 + row.margin_percent / 100));
    }).length,
    nonzero_stock: products.filter((row) => row.stock !== 0).length,
    availability_not_consult: products.filter((row) => row.availability_status !== "CONSULT").length,
    missing_image: products.filter((row) => !row.image_url).length,
    images_outside_fzac_storage: products.filter((row) => !String(row.image_url).includes("/storage/v1/object/public/product-images/la-yesera-rosarina/")).length
  };

  await mkdir("data/imports", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify({ generated_at: new Date().toISOString(), summary, duplicates, products }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT, summary }, null, 2));
  if (summary.exact_duplicates || summary.invalid_margin || summary.nonzero_stock || summary.availability_not_consult || summary.missing_image) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
