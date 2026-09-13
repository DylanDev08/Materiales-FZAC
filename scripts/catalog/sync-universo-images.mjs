import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const SOURCE = "Universo Pinturas SRL Rosario";
const SUPPLIER_CODE = "UNIVERSO-PINTURAS-SRL";
const BUCKET = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
const OUTPUT = "data/imports/universo-pinturas-images.preview.json";
const APPLY = process.argv.includes("--apply");
const USER_AGENT = "MaterialesFZACAssetSync/1.0 (+https://materiales-fzac-8xmp.onrender.com/)";
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const PAGE_SIZE = 500;

function loadEnvironment() {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]) delete process.env[name];
  }
  try {
    process.loadEnvFile(".env");
  } catch {
    // The explicit validation below reports a safe error.
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

function absoluteImageUrl(value) {
  try {
    const url = new URL(String(value ?? ""));
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function loadSources(db, supplierId) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db.from("product_supplier_sources")
      .select("id,product_id,source_product_id,source_image_url,products!inner(name,image_url)")
      .eq("supplier_id", supplierId)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function downloadAndOptimize(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/png,image/jpeg" },
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Imagen fuente HTTP ${response.status}`);
  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_SOURCE_BYTES) throw new Error("Imagen fuente demasiado grande");
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new Error("Imagen fuente vacía o demasiado grande");
  const image = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Formato de imagen no reconocido");
  return image
    .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();
}

async function mapWithConcurrency(rows, concurrency, task) {
  const output = new Array(rows.length);
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const index = next++;
      output[index] = await task(rows[index], index);
      if ((index + 1) % 50 === 0 || index + 1 === rows.length) {
        console.log(`Imágenes procesadas: ${index + 1}/${rows.length}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));
  return output;
}

async function main() {
  const db = supabaseClient();
  const [{ data: buckets, error: bucketError }, { data: supplier, error: supplierError }] = await Promise.all([
    db.storage.listBuckets(),
    db.from("suppliers").select("id,name").eq("code", SUPPLIER_CODE).single()
  ]);
  if (bucketError || supplierError) throw bucketError || supplierError;
  const bucket = buckets.find((item) => item.id === BUCKET);
  if (!bucket?.public) throw new Error(`El bucket ${BUCKET} no existe o no es público.`);

  const sources = await loadSources(db, supplier.id);
  const storageBase = db.storage.from(BUCKET).getPublicUrl("universo-pinturas/").data.publicUrl;
  const plan = sources.map((row) => ({
    source_row_id: row.id,
    product_id: row.product_id,
    source_product_id: row.source_product_id,
    product_name: row.products.name,
    source_image_url: absoluteImageUrl(row.source_image_url),
    current_image_url: row.products.image_url || null,
    storage_path: `universo-pinturas/${row.product_id}.webp`,
    already_in_own_storage: Boolean(row.products.image_url?.startsWith(storageBase))
  }));
  const preview = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    source: SOURCE,
    authorization_basis: "El propietario de Materiales FZAC autorizó reutilizar las imágenes comerciales del proveedor.",
    bucket: BUCKET,
    summary: {
      products: plan.length,
      source_images_known: plan.filter((row) => row.source_image_url).length,
      pending_upload: plan.filter((row) => row.source_image_url && !row.already_in_own_storage).length,
      already_in_own_storage: plan.filter((row) => row.already_in_own_storage).length,
      missing_source_image: plan.filter((row) => !row.source_image_url).length
    },
    products: plan
  };
  await writeFile(OUTPUT, `${JSON.stringify(preview, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT, summary: preview.summary }, null, 2));
  if (!APPLY) return;

  const results = await mapWithConcurrency(plan, 8, async (row) => {
    try {
      if (row.already_in_own_storage) return { product_id: row.product_id, status: "SKIPPED", reason: "Ya está en Storage propio" };
      if (!row.source_image_url) throw new Error("La fuente no publicó imagen principal");
      const optimized = await downloadAndOptimize(row.source_image_url);
      const { error: uploadError } = await db.storage.from(BUCKET).upload(row.storage_path, optimized, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true
      });
      if (uploadError) throw uploadError;
      const publicUrl = db.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
      const { error: productError } = await db.from("products").update({ image_url: publicUrl }).eq("id", row.product_id);
      if (productError) throw productError;
      return { product_id: row.product_id, status: "UPLOADED", public_url: publicUrl, bytes: optimized.length };
    } catch (error) {
      return { product_id: row.product_id, status: "ERROR", error: error instanceof Error ? error.message : String(error) };
    }
  });
  const summary = {
    uploaded: results.filter((row) => row.status === "UPLOADED").length,
    skipped: results.filter((row) => row.status === "SKIPPED").length,
    errors: results.filter((row) => row.status === "ERROR").length,
    total_bytes: results.reduce((total, row) => total + (row.bytes || 0), 0)
  };
  await writeFile(OUTPUT, `${JSON.stringify({ ...preview, applied_at: new Date().toISOString(), results, applied_summary: summary }, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ output: OUTPUT, summary }, null, 2));
  if (summary.errors) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
