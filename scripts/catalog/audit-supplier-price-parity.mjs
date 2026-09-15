import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

const YESERA_CODE = "LA-YESERA-ROSARINA";
const UNIVERSO_CODE = "UNIVERSO-PINTURAS-SRL";
const TARGET_CODES = new Set([YESERA_CODE, UNIVERSO_CODE]);

function loadEnvironment() {
  try {
    process.loadEnvFile(".env");
  } catch {
    // Configuration is validated below without logging values.
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Falta configuración Supabase server-side.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
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

export function expectedMargin(supplierCode, originalPrice) {
  const price = Number(originalPrice);
  if (!Number.isFinite(price) || price <= 0) return null;
  if (supplierCode === YESERA_CODE) return price > 60_000 ? 10 : 20;
  if (supplierCode === UNIVERSO_CODE) return 0;
  return null;
}

export function expectedPrice(supplierCode, originalPrice) {
  const price = Number(originalPrice);
  const margin = expectedMargin(supplierCode, price);
  if (margin === null) return null;
  if (supplierCode === UNIVERSO_CODE) return Number(price.toFixed(2));
  return Math.round(price * (1 + margin / 100));
}

export function auditStatus(row) {
  if (!row.supplier_name) return "MISSING_SUPPLIER";
  if (!Number.isFinite(row.original_price) || row.original_price <= 0) return "MISSING_SOURCE_PRICE";
  if (!row.source_url) return "MISSING_SOURCE_URL";
  if (row.expected_margin_percent === null || !Number.isFinite(row.expected_fzac_price)) return "MANUAL_REVIEW";
  if (row.current_fzac_price > row.expected_fzac_price) return "PRICE_TOO_HIGH";
  if (row.current_fzac_price < row.expected_fzac_price) return "PRICE_TOO_LOW";
  if (row.current_margin_percent !== row.expected_margin_percent) return "MANUAL_REVIEW";
  return "OK";
}

function markdownCell(value) {
  return String(value ?? "-").replaceAll("|", "\\|").replaceAll("\n", " ");
}

async function audit() {
  const db = client();
  const [products, suppliers, sources] = await Promise.all([
    readAll(() => db.from("products").select("id,name,sku,slug,price,supplier_id,image_url,description,availability_status,active")),
    readAll(() => db.from("suppliers").select("id,name,code")),
    readAll(() => db.from("product_supplier_sources").select("product_id,supplier_id,source_product_id,source_url,original_price,margin_percent"))
  ]);
  const supplierById = new Map(suppliers.map((row) => [row.id, row]));
  const sourceByProduct = new Map(sources.map((row) => [row.product_id, row]));

  const rows = products.flatMap((product) => {
    const source = sourceByProduct.get(product.id);
    const supplier = supplierById.get(source?.supplier_id ?? product.supplier_id);
    if (supplier?.code && !TARGET_CODES.has(supplier.code)) return [];
    if (!source && product.supplier_id) return [];
    const originalPrice = source?.original_price == null ? null : Number(source.original_price);
    const margin = source?.margin_percent == null ? null : Number(source.margin_percent);
    const expectedMarginPercent = expectedMargin(supplier?.code, originalPrice);
    const expectedFzacPrice = expectedPrice(supplier?.code, originalPrice);
    const row = {
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      slug: product.slug,
      supplier_name: supplier?.name ?? null,
      supplier_code: supplier?.code ?? null,
      source_product_id: source?.source_product_id ?? null,
      source_url: source?.source_url ?? null,
      original_price: originalPrice,
      current_margin_percent: margin,
      expected_margin_percent: expectedMarginPercent,
      current_fzac_price: Number(product.price),
      expected_fzac_price: expectedFzacPrice,
      difference: expectedFzacPrice === null ? null : Number(product.price) - expectedFzacPrice,
      missing_image: !String(product.image_url ?? "").trim(),
      missing_description: !String(product.description ?? "").trim(),
      availability_status: product.availability_status,
      active: Boolean(product.active)
    };
    return [{ ...row, status: auditStatus(row) }];
  });

  const counts = Object.fromEntries(
    ["OK", "PRICE_TOO_HIGH", "PRICE_TOO_LOW", "MISSING_SOURCE_PRICE", "MISSING_SOURCE_URL", "MISSING_SUPPLIER", "MANUAL_REVIEW"]
      .map((status) => [status, rows.filter((row) => row.status === status).length])
  );
  const summary = {
    rows: rows.length,
    yesera: rows.filter((row) => row.supplier_code === YESERA_CODE).length,
    universo: rows.filter((row) => row.supplier_code === UNIVERSO_CODE).length,
    margin_10: rows.filter((row) => row.expected_margin_percent === 10).length,
    margin_20: rows.filter((row) => row.expected_margin_percent === 20).length,
    margin_0: rows.filter((row) => row.expected_margin_percent === 0).length,
    missing_image: rows.filter((row) => row.missing_image).length,
    missing_description: rows.filter((row) => row.missing_description).length,
    consult: rows.filter((row) => row.availability_status === "CONSULT").length,
    ...counts
  };

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const jsonPath = `data/audits/supplier-price-parity-${date}.json`;
  const markdownPath = `docs/audits/supplier-price-parity-${date}.md`;
  const visibleIssues = rows.filter((row) => row.status !== "OK").slice(0, 250);
  const markdown = [
    "# Auditoría interna de paridad de proveedores",
    "",
    `Generada: ${now.toISOString()}`,
    "",
    "> Documento interno: contiene precios de origen y no debe publicarse ni versionarse.",
    "",
    "## Resumen",
    "",
    "```json",
    JSON.stringify(summary, null, 2),
    "```",
    "",
    "## Diferencias y faltantes",
    "",
    "| Producto | SKU | Proveedor | Origen | Margen actual/esperado | FZAC actual/esperado | Diferencia | Estado |",
    "| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
    ...visibleIssues.map((row) => `| ${markdownCell(row.product_name)} | ${markdownCell(row.sku)} | ${markdownCell(row.supplier_name)} | ${row.original_price ?? "-"} | ${row.current_margin_percent ?? "-"}/${row.expected_margin_percent ?? "-"} | ${row.current_fzac_price}/${row.expected_fzac_price ?? "-"} | ${row.difference ?? "-"} | ${row.status} |`),
    ""
  ].join("\n");
  await Promise.all([mkdir("data/audits", { recursive: true }), mkdir("docs/audits", { recursive: true })]);
  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify({ generated_at: now.toISOString(), summary, rows }, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, markdown, "utf8")
  ]);
  return { jsonPath, markdownPath, summary };
}

async function main() {
  const result = await audit();
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
