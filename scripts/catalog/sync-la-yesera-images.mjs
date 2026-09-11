import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = process.env.SUPABASE_PRODUCT_IMAGES_BUCKET || "product-images";
const OUTPUT = "data/imports/la-yesera-images.preview.json";
const APPLY = process.argv.includes("--apply");
const USER_AGENT = "MaterialesFZACAssetSync/1.0 (+https://materiales-fzac-8xmp.onrender.com/)";
const MAX_SOURCE_BYTES = 15 * 1024 * 1024;
const GENERATED_FALLBACKS = new Map([
  ["795eda27-b8e1-4ec1-9da1-67c47d59ae80", "public/products/fzac/base-coat-bicomponente.webp"]
]);

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
  const databaseProjectRef = process.env.DATABASE_URL?.match(/db\.([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"]
    || process.env.SUPABASE_URL
    || (databaseProjectRef ? `https://${databaseProjectRef}.supabase.co` : "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configuración Supabase server-side.");
  return createClient(url.replace(/^['"]|['"]$/g, ""), key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function absoluteImageUrl(value) {
  if (!value) return null;
  if (value.startsWith("//")) return `https:${value}`;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function imageFromProductPage(sourceUrl) {
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Detalle fuente HTTP ${response.status}`);
  const html = await response.text();
  const match = html.match(/<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)/i)
    || html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i);
  return absoluteImageUrl(match?.[1]?.replaceAll("&amp;", "&"));
}

async function optimizeImage(bytes) {
  if (!bytes.length || bytes.length > MAX_SOURCE_BYTES) throw new Error("Imagen fuente vacía o demasiado grande");
  const image = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) throw new Error("Formato de imagen no reconocido");
  return image
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

async function downloadAndOptimize(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/avif,image/webp,image/png,image/jpeg" },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`Imagen fuente HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return optimizeImage(bytes);
}

async function mapWithConcurrency(rows, concurrency, task) {
  const output = new Array(rows.length);
  let next = 0;
  async function worker() {
    while (next < rows.length) {
      const index = next++;
      output[index] = await task(rows[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, rows.length) }, () => worker()));
  return output;
}

async function main() {
  const db = supabaseClient();
  const [{ data: buckets, error: bucketError }, { data: sources, error: sourceError }] = await Promise.all([
    db.storage.listBuckets(),
    db.from("product_supplier_sources")
      .select("id,product_id,source_product_id,source_url,source_image_url,products!inner(name,image_url,gallery,stock,availability_status)")
      .eq("source", "La Yesera Rosarina")
      .limit(1000)
  ]);
  if (bucketError || sourceError) throw bucketError || sourceError;
  const bucket = buckets.find((item) => item.id === BUCKET);
  if (!bucket?.public) throw new Error(`El bucket ${BUCKET} no existe o no es público.`);

  const plan = sources.map((row) => ({
    source_row_id: row.id,
    product_id: row.product_id,
    source_product_id: row.source_product_id,
    product_name: row.products.name,
    source_url: row.source_url,
    source_image_url: absoluteImageUrl(row.source_image_url),
    current_image_url: row.products.image_url || null,
    generated_fallback: GENERATED_FALLBACKS.get(row.product_id) || null,
    storage_path: `la-yesera-rosarina/${row.product_id}.webp`,
    stock: Number(row.products.stock ?? 0),
    availability_status: row.products.availability_status
  }));

  const preview = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    authorization_basis: "El propietario de Materiales FZAC confirmó autorización comercial para reutilizar las imágenes el 2026-09-10.",
    bucket: BUCKET,
    summary: {
      products: plan.length,
      source_images_known: plan.filter((row) => row.source_image_url).length,
      source_images_to_discover: plan.filter((row) => !row.source_image_url).length,
      existing_product_images_preserved: plan.filter((row) => row.current_image_url).length
    },
    products: plan
  };
  await writeFile(OUTPUT, `${JSON.stringify(preview, null, 2)}\n`, "utf8");

  if (!APPLY) {
    console.log(JSON.stringify({ output: OUTPUT, summary: preview.summary }, null, 2));
    return;
  }

  const results = await mapWithConcurrency(plan, 3, async (row) => {
    try {
      if (row.current_image_url) {
        return { product_id: row.product_id, status: "SKIPPED", reason: "El producto ya tiene una imagen propia" };
      }
      let sourceImageUrl = row.source_image_url;
      let optimized;
      let origin = "SOURCE";
      if (!sourceImageUrl && row.generated_fallback) {
        optimized = await optimizeImage(await readFile(row.generated_fallback));
        origin = "AUTHORIZED_GENERATED_FALLBACK";
      } else {
        if (!sourceImageUrl) sourceImageUrl = await imageFromProductPage(row.source_url);
        if (!sourceImageUrl) throw new Error("La página fuente no publica una imagen principal");
        optimized = await downloadAndOptimize(sourceImageUrl);
      }
      const { error: uploadError } = await db.storage.from(BUCKET).upload(row.storage_path, optimized, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: true
      });
      if (uploadError) throw uploadError;
      const publicUrl = db.storage.from(BUCKET).getPublicUrl(row.storage_path).data.publicUrl;
      const { error: productError } = await db.from("products").update({ image_url: publicUrl }).eq("id", row.product_id);
      if (productError) throw productError;
      if (!row.source_image_url && sourceImageUrl) {
        const { error: sourceUpdateError } = await db.from("product_supplier_sources").update({ source_image_url: sourceImageUrl }).eq("id", row.source_row_id);
        if (sourceUpdateError) throw sourceUpdateError;
      }
      return { product_id: row.product_id, status: "UPLOADED", origin, public_url: publicUrl, bytes: optimized.length };
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

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
