import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const OUTPUT = "data/imports/fzac-storefront-taxonomy.preview.json";
const CATEGORY_SLUGS = ["construccion-en-seco", "steel-framing", "ferreteria"];

function loadEnvironment() {
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL", "DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!process.env[name]) delete process.env[name];
  }
  try {
    process.loadEnvFile(".env");
  } catch {
    // Explicit validation below keeps secrets out of error output.
  }
}

function supabaseClient() {
  loadEnvironment();
  const projectRef = process.env.DATABASE_URL?.match(/db\.([a-z0-9-]+)\.supabase\.co/i)?.[1];
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL
    || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"]
    || process.env.SUPABASE_URL
    || (projectRef ? `https://${projectRef}.supabase.co` : "")
  ).replace(/^['"]|['"]$/g, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configuración Supabase server-side.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function normalized(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function storefrontCategorySlug(name) {
  const value = normalized(name);
  if (/\b(tornillo|tornillos|tarugo|tarugos)\b/.test(value)) return "ferreteria";
  if (/\b(pgc|pgu|superboard|siding)\b/.test(value) || value.includes("base coat")) return "steel-framing";
  return "construccion-en-seco";
}

async function ensureSupplier(db, suppliers, currentCode, target) {
  const current = suppliers.find((supplier) => supplier.code === currentCode);
  const targetRow = suppliers.find((supplier) => supplier.code === target.code);

  if (targetRow) {
    const { error } = await db.from("suppliers").update({ name: target.name, active: true }).eq("id", targetRow.id);
    if (error) throw error;
    if (current && current.id !== targetRow.id) {
      const { error: inactiveError } = await db.from("suppliers").update({ active: false }).eq("id", current.id);
      if (inactiveError) throw inactiveError;
    }
    return targetRow.id;
  }

  if (current) {
    const { error } = await db.from("suppliers").update({ code: target.code, name: target.name, active: true }).eq("id", current.id);
    if (error) throw error;
    return current.id;
  }

  const { data, error } = await db.from("suppliers").insert({ ...target, active: true }).select("id").single();
  if (error) throw error;
  return data.id;
}

async function main() {
  const db = supabaseClient();
  const [{ data: categories, error: categoryError }, { data: suppliers, error: supplierError }] = await Promise.all([
    db.from("categories").select("id,name,slug").in("slug", CATEGORY_SLUGS),
    db.from("suppliers").select("id,code,name,active")
  ]);
  if (categoryError || supplierError) throw categoryError || supplierError;

  const categoryBySlug = new Map((categories ?? []).map((category) => [category.slug, category]));
  const missingCategories = CATEGORY_SLUGS.filter((slug) => !categoryBySlug.has(slug));
  if (missingCategories.length) throw new Error(`Faltan categorías requeridas: ${missingCategories.join(", ")}`);

  const yesera = (suppliers ?? []).find((supplier) => supplier.code === "LA-YESERA-ROSARINA");
  if (!yesera) throw new Error("No existe el proveedor fuente LA-YESERA-ROSARINA.");
  const { data: products, error: productError } = await db
    .from("products")
    .select("id,name,sku,category_id,stock,availability_status")
    .eq("supplier_id", yesera.id)
    .limit(1000);
  if (productError) throw productError;

  const changes = (products ?? []).flatMap((product) => {
    const targetSlug = storefrontCategorySlug(product.name);
    const target = categoryBySlug.get(targetSlug);
    return target && product.category_id !== target.id
      ? [{ product_id: product.id, name: product.name, sku: product.sku, from_category_id: product.category_id, to_category_id: target.id, to_category_slug: targetSlug }]
      : [];
  });

  const preview = {
    generated_at: new Date().toISOString(),
    apply: APPLY,
    rules: {
      public_supplier_code: "LA-YESERA-ROSARINA",
      public_categories: CATEGORY_SLUGS,
      ferreteria: "nombres con tornillo/tarugo",
      steel_framing: "nombres con PGC/PGU/Superboard/Siding/Base Coat",
      default: "construccion-en-seco"
    },
    supplier_plan: [
      { code: "LA-YESERA-ROSARINA", name: "Yesera Rosarina" },
      { code: "URBE-SRL", name: "Urbe SRL" },
      { code: "MAQUINARIA-SORRENTOS", name: "Maquinaria Sorrentos", rename_from: "UNIVERSO-PINTURAS" }
    ],
    summary: {
      supplier_products: products?.length ?? 0,
      category_changes: changes.length,
      stock_not_modified: true,
      prices_not_modified: true
    },
    changes
  };
  await mkdir("data/imports", { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(preview, null, 2)}\n`, "utf8");

  if (!APPLY) {
    console.log(JSON.stringify({ output: OUTPUT, summary: preview.summary }, null, 2));
    return;
  }

  await ensureSupplier(db, suppliers ?? [], "LA-YESERA-ROSARINA", { code: "LA-YESERA-ROSARINA", name: "Yesera Rosarina" });
  await ensureSupplier(db, suppliers ?? [], "URBE-SRL", { code: "URBE-SRL", name: "Urbe SRL" });
  await ensureSupplier(db, suppliers ?? [], "UNIVERSO-PINTURAS", { code: "MAQUINARIA-SORRENTOS", name: "Maquinaria Sorrentos" });

  for (const slug of CATEGORY_SLUGS) {
    const ids = changes.filter((change) => change.to_category_slug === slug).map((change) => change.product_id);
    if (!ids.length) continue;
    const { error } = await db.from("products").update({ category_id: categoryBySlug.get(slug).id }).in("id", ids);
    if (error) throw error;
  }

  console.log(JSON.stringify({ output: OUTPUT, applied: true, summary: preview.summary }, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
