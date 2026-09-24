import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminApiContext } from "@/lib/auth/admin-api";
import { invalidateAssistantCatalogCache } from "@/lib/assistant/catalog-intelligence";
import {
  expectedSupplierMargin,
  expectedSupplierPrice,
  supplierAuditStatus,
  UNIVERSO_SUPPLIER_CODE,
  YESERA_SUPPLIER_CODE,
  type SupplierPricingRule
} from "@/lib/supplier-pricing/rules";
import { jsonError } from "@/lib/utils/api";
import { readLimitedJson } from "@/lib/utils/request-security";

type AdminClient = SupabaseClient;
type ProductRow = {
  id: string; name: string; sku: string; slug: string; price: number | string; supplier_id: string | null;
  image_url: string | null; description: string | null; availability_status: string; active: boolean;
};
type SupplierRow = {
  id: string;
  name: string;
  code: string;
  pricing_margin_percent: number | string | null;
  pricing_threshold_amount: number | string | null;
  pricing_margin_above_threshold_percent: number | string | null;
  pricing_round_to_whole_peso: boolean;
};
type SourceRow = {
  product_id: string; supplier_id: string; source_product_id: string; source_url: string | null;
  original_price: number | string | null; margin_percent: number | string | null;
  manual_review_required: boolean; manual_review_reason: string | null;
};

const recalculateSchema = z.object({
  productId: z.string().uuid(),
  expectedCurrentPrice: z.number().finite().nonnegative()
});

const pricingRuleSchema = z.object({
  supplierCode: z.enum([YESERA_SUPPLIER_CODE, UNIVERSO_SUPPLIER_CODE]),
  marginPercent: z.number().finite().min(0).max(200),
  thresholdAmount: z.number().finite().positive().nullable(),
  marginAboveThresholdPercent: z.number().finite().min(0).max(200).nullable(),
  roundToWholePeso: z.boolean(),
  applyNow: z.boolean().default(false)
}).superRefine((value, context) => {
  const thresholdConfigured = value.thresholdAmount !== null;
  const upperMarginConfigured = value.marginAboveThresholdPercent !== null;
  if (thresholdConfigured !== upperMarginConfigured) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Umbral y margen superior deben configurarse juntos."
    });
  }
});

const supplierCodes = new Set([YESERA_SUPPLIER_CODE, UNIVERSO_SUPPLIER_CODE]);

function numericOrNull(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pricingRuleFromSupplier(supplier: SupplierRow | null | undefined): SupplierPricingRule | null {
  if (!supplier) return null;
  return {
    marginPercent: numericOrNull(supplier.pricing_margin_percent),
    thresholdAmount: numericOrNull(supplier.pricing_threshold_amount),
    marginAboveThresholdPercent: numericOrNull(supplier.pricing_margin_above_threshold_percent),
    roundToWholePeso: Boolean(supplier.pricing_round_to_whole_peso)
  };
}

async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  const pageSize = 1_000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await query(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if ((data ?? []).length < pageSize) return rows;
  }
}

async function auditData(admin: AdminClient) {
  const [products, suppliers, sources] = await Promise.all([
    readAll<ProductRow>((from, to) => admin.from("products").select("id,name,sku,slug,price,supplier_id,image_url,description,availability_status,active").eq("active", true).range(from, to)),
    readAll<SupplierRow>((from, to) => admin.from("suppliers").select("id,name,code,pricing_margin_percent,pricing_threshold_amount,pricing_margin_above_threshold_percent,pricing_round_to_whole_peso").range(from, to)),
    readAll<SourceRow>((from, to) => admin.from("product_supplier_sources").select("product_id,supplier_id,source_product_id,source_url,original_price,margin_percent,manual_review_required,manual_review_reason").range(from, to))
  ]);
  const supplierById = new Map(suppliers.map((row) => [row.id, row]));
  const sourceByProduct = new Map(sources.map((row) => [row.product_id, row]));

  const rows = products.flatMap((product) => {
    const source = sourceByProduct.get(product.id);
    const supplier = supplierById.get(source?.supplier_id ?? product.supplier_id ?? "");
    if (supplier?.code && !supplierCodes.has(supplier.code)) return [];
    if (!source && product.supplier_id) return [];
    const originalPrice = source?.original_price == null ? null : Number(source.original_price);
    const currentMargin = source?.margin_percent == null ? null : Number(source.margin_percent);
    const rule = pricingRuleFromSupplier(supplier);
    const expectedMargin = expectedSupplierMargin(supplier?.code, originalPrice, rule);
    const expectedPrice = expectedSupplierPrice(supplier?.code, originalPrice, rule);
    const currentPrice = Number(product.price);
    const status = source?.manual_review_required ? "MANUAL_REVIEW" : supplierAuditStatus({
      supplierName: supplier?.name ?? null,
      originalPrice,
      sourceUrl: source?.source_url ?? null,
      currentPrice,
      currentMargin,
      expectedPrice,
      expectedMargin
    });
    return [{
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      slug: product.slug,
      supplierName: supplier?.name ?? null,
      supplierCode: supplier?.code ?? null,
      sourceUrl: source?.source_url ?? null,
      originalPrice,
      currentMargin,
      expectedMargin,
      currentPrice,
      expectedPrice,
      manualReviewRequired: Boolean(source?.manual_review_required),
      manualReviewReason: source?.manual_review_reason ?? null,
      difference: expectedPrice === null ? null : Number((currentPrice - expectedPrice).toFixed(2)),
      missingImage: !String(product.image_url ?? "").trim(),
      missingDescription: !String(product.description ?? "").trim(),
      availabilityStatus: product.availability_status,
      active: product.active,
      status
    }];
  });

  const activeSupplierCodes = new Set(rows.map((row) => row.supplierCode).filter((code): code is string => Boolean(code)));
  const pricingRules = suppliers
    .filter((supplier) => supplierCodes.has(supplier.code) && activeSupplierCodes.has(supplier.code))
    .map((supplier) => ({
      supplierId: supplier.id,
      supplierCode: supplier.code,
      supplierName: supplier.name,
      ...pricingRuleFromSupplier(supplier)
    }));

  return { rows, pricingRules };
}

export async function GET(request: Request) {
  const context = await getAdminApiContext(request, { scope: "admin-supplier-price-audit", limit: 30 });
  if (!context.ok) return context.response;
  try {
    const { rows, pricingRules } = await auditData(context.admin);
    return Response.json({
      rows,
      pricingRules,
      summary: {
        total: rows.length,
        differences: rows.filter((row) => row.status === "PRICE_TOO_HIGH" || row.status === "PRICE_TOO_LOW").length,
        wrongMargin: rows.filter((row) => row.status === "MANUAL_REVIEW").length,
        missingImage: rows.filter((row) => row.missingImage).length,
        missingDescription: rows.filter((row) => row.missingDescription).length,
        missingSupplier: rows.filter((row) => row.status === "MISSING_SUPPLIER").length,
        consult: rows.filter((row) => row.availabilityStatus === "CONSULT").length,
        missingSourceUrl: rows.filter((row) => row.status === "MISSING_SOURCE_URL").length,
        missingSourcePrice: rows.filter((row) => row.status === "MISSING_SOURCE_PRICE").length
      }
    }, { headers: { "Cache-Control": "no-store, private" } });
  } catch {
    return jsonError("No pudimos generar la auditoría privada de precios.", 500);
  }
}

export async function POST(request: Request) {
  const body = await readLimitedJson(request, 4 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);
  const parsed = recalculateSchema.safeParse(body.data);
  if (!parsed.success) return jsonError("Datos de recálculo inválidos.", 422);
  const context = await getAdminApiContext(request, { scope: "admin-supplier-price-recalculate", limit: 12 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  const { data: product } = await admin.from("products").select("id,name,price").eq("id", parsed.data.productId).maybeSingle();
  const { data: source } = await admin.from("product_supplier_sources").select("supplier_id,original_price,margin_percent,manual_review_required,manual_review_reason").eq("product_id", parsed.data.productId).maybeSingle();
  if (!product || !source) return jsonError("El producto no tiene una fuente recalculable.", 404);
  if (source.manual_review_required) {
    return jsonError(source.manual_review_reason || "El precio fuente requiere revisión manual antes de recalcular.", 409);
  }
  const { data: supplier } = await admin
    .from("suppliers")
    .select("name,code,pricing_margin_percent,pricing_threshold_amount,pricing_margin_above_threshold_percent,pricing_round_to_whole_peso")
    .eq("id", source.supplier_id)
    .maybeSingle();
  if (!supplier || !supplierCodes.has(supplier.code)) return jsonError("Proveedor fuera del alcance permitido.", 422);
  if (Number(product.price) !== parsed.data.expectedCurrentPrice) {
    return jsonError("El precio cambió desde que abriste la auditoría. Actualizá la pantalla.", 409);
  }

  const originalPrice = Number(source.original_price);
  const rule = pricingRuleFromSupplier(supplier as SupplierRow);
  const price = expectedSupplierPrice(supplier.code, originalPrice, rule);
  const margin = expectedSupplierMargin(supplier.code, originalPrice, rule);
  if (price === null || margin === null) return jsonError("La fuente no tiene un precio válido.", 422);

  const previousMargin = Number(source.margin_percent);
  const { error: sourceError } = await admin.from("product_supplier_sources")
    .update({ margin_percent: margin, checked_at: new Date().toISOString() })
    .eq("product_id", product.id);
  if (sourceError) return jsonError("No pudimos actualizar la regla del proveedor.", 409);

  const { data: updatedProduct, error: productError } = await admin.from("products")
    .update({ price, updated_at: new Date().toISOString() })
    .eq("id", product.id)
    .eq("price", parsed.data.expectedCurrentPrice)
    .select("id")
    .maybeSingle();
  if (productError || !updatedProduct) {
    await admin.from("product_supplier_sources").update({ margin_percent: previousMargin }).eq("product_id", product.id);
    return jsonError("El precio cambió durante el recálculo. Actualizá la auditoría.", 409);
  }

  invalidateAssistantCatalogCache();
  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    actor_role: profile.role,
    action: "SUPPLIER_PRICE_RECALCULATED",
    entity: "products",
    entity_id: product.id,
    message: `Precio recalculado desde la regla privada de ${supplier.name}: ${product.name}`
  });
  return Response.json({ ok: true, message: "Precio y margen recalculados con la fuente vigente." });
}

export async function PUT(request: Request) {
  const body = await readLimitedJson(request, 8 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);
  const parsed = pricingRuleSchema.safeParse(body.data);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Regla comercial inválida.", 422);

  if (
    parsed.data.applyNow &&
    (parsed.data.marginPercent <= 0 ||
      (parsed.data.marginAboveThresholdPercent !== null && parsed.data.marginAboveThresholdPercent <= 0))
  ) {
    return jsonError(
      "Para aplicar la regla al catálogo definí márgenes mayores a 0%. Un margen 0% puede guardarse sólo como referencia.",
      422
    );
  }

  const context = await getAdminApiContext(request, { scope: "admin-supplier-pricing-rule", limit: 8 });
  if (!context.ok) return context.response;
  const { admin, profile } = context;

  const { data: supplier, error: supplierError } = await admin
    .from("suppliers")
    .update({
      pricing_margin_percent: parsed.data.marginPercent,
      pricing_threshold_amount: parsed.data.thresholdAmount,
      pricing_margin_above_threshold_percent: parsed.data.marginAboveThresholdPercent,
      pricing_round_to_whole_peso: parsed.data.roundToWholePeso,
      updated_by: profile.id,
      updated_at: new Date().toISOString()
    })
    .eq("code", parsed.data.supplierCode)
    .select("id,name,code")
    .maybeSingle();

  if (supplierError || !supplier) return jsonError("No pudimos guardar la regla del proveedor.", 409);

  let updatedProducts = 0;
  if (parsed.data.applyNow) {
    const { data, error } = await admin.rpc("apply_supplier_pricing_rule", {
      p_supplier_code: parsed.data.supplierCode
    });
    if (error) return jsonError("La regla se guardó, pero no pudimos aplicarla al catálogo.", 409);
    updatedProducts = Number(data ?? 0);
    invalidateAssistantCatalogCache();
  }

  await admin.from("admin_audit_logs").insert({
    actor_id: profile.id,
    actor_email: profile.email,
    actor_role: profile.role,
    action: parsed.data.applyNow ? "SUPPLIER_PRICING_RULE_APPLIED" : "SUPPLIER_PRICING_RULE_UPDATED",
    entity: "suppliers",
    entity_id: supplier.id,
    message: parsed.data.applyNow
      ? `Regla comercial aplicada a ${supplier.name}. Productos actualizados: ${updatedProducts}.`
      : `Regla comercial actualizada para ${supplier.name} sin modificar precios.`,
    metadata: {
      margin_percent: parsed.data.marginPercent,
      threshold_amount: parsed.data.thresholdAmount,
      margin_above_threshold_percent: parsed.data.marginAboveThresholdPercent,
      round_to_whole_peso: parsed.data.roundToWholePeso,
      updated_products: updatedProducts
    }
  });

  return Response.json({
    ok: true,
    updatedProducts,
    message: parsed.data.applyNow
      ? `Regla aplicada correctamente a ${updatedProducts} productos.`
      : "Regla guardada. Los precios todavía no fueron modificados."
  });
}
