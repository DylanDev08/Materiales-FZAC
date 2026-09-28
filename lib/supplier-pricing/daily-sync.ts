import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type SourceRow = {
  id: string;
  product_id: string;
  supplier_id: string;
  source_url: string;
  original_price: number | string;
  margin_percent: number | string;
  manual_review_required: boolean;
  product?: {
    id: string;
    name: string;
    sku: string;
    price: number | string;
    category_id: string | null;
    active: boolean;
  } | null;
  supplier?: {
    id: string;
    name: string;
    website_url: string | null;
    catalog_url: string | null;
  } | null;
};

function toNumber(value: unknown) {
  const cleaned = String(value ?? "").trim().replace(/[^0-9,.-]/g, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  const comma = cleaned.lastIndexOf(",");
  const dot = cleaned.lastIndexOf(".");

  if (comma >= 0 && dot >= 0) {
    normalized = comma > dot
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (comma >= 0) {
    const decimals = cleaned.length - comma - 1;
    normalized = decimals > 0 && decimals <= 2
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (dot >= 0) {
    const parts = cleaned.split(".");
    normalized = parts.length > 2 || (parts.length === 2 && parts[1].length === 3)
      ? cleaned.replace(/\./g, "")
      : cleaned;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function hostOf(value: string | null | undefined) {
  try { return value ? new URL(value).hostname.toLowerCase() : ""; } catch { return ""; }
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^(fe8|fe9|fea|feb)/.test(normalized)) return true;
  const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  const p = ipv4.split(".").map(Number);
  if (p.length !== 4 || p.some((x) => !Number.isInteger(x))) return false;
  return p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}

async function assertSafeSourceUrl(value: string, supplierHosts: string[]) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) throw new Error("URL no permitida");
  const host = url.hostname.toLowerCase();
  const allowed = supplierHosts.some((base) => host === base || host.endsWith(`.${base}`));
  if (!allowed || isIP(host) !== 0 || host === "localhost" || host.endsWith(".local")) throw new Error("Host no autorizado");
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Red no permitida");
  return url;
}

async function readBody(response: Response, max = 750_000) {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > max) throw new Error("Respuesta demasiado grande");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Respuesta vacía");
  const decoder = new TextDecoder();
  let size = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new Error("Respuesta demasiado grande"); }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

function findPriceInJson(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) { const found = findPriceInJson(item); if (found) return found; }
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.offers) {
    const offer = findPriceInJson(row.offers);
    if (offer) return offer;
  }
  if ("price" in row) {
    const parsed = toNumber(row.price);
    if (parsed && parsed > 0) return parsed;
  }
  for (const child of Object.values(row)) {
    if (child && typeof child === "object") {
      const found = findPriceInJson(child);
      if (found) return found;
    }
  }
  return null;
}

function extractPrice(html: string) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const price = findPriceInJson(parsed);
      if (price) return price;
    } catch {}
  }
  const metaPatterns = [
    /<meta[^>]+(?:property|itemprop)=["'](?:product:price:amount|price)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|itemprop)=["'](?:product:price:amount|price)["']/i
  ];
  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    const price = match ? toNumber(match[1]) : null;
    if (price && price > 0) return price;
  }
  return null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b)=>a-b);
  const mid = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid-1]+sorted[mid])/2;
}

export async function runDailySupplierPricingSync() {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Backend administrativo no disponible.");

  const [{ data: rules }, { data: sources }, { data: trusted }, { data: observations }, { data: history }] = await Promise.all([
    admin.from("category_pricing_rules").select("category_id,target_margin_pct,auto_update_threshold_pct,alert_over_market_pct,active"),
    admin.from("product_supplier_sources")
      .select("id,product_id,supplier_id,source_url,original_price,margin_percent,manual_review_required,product:products!inner(id,name,sku,price,category_id,active),supplier:suppliers(id,name,website_url,catalog_url)")
      .limit(2_000),
    admin.from("market_price_sources").select("id").eq("active",true).eq("trusted",true).limit(100),
    admin.from("market_price_observations").select("product_id,source_id,normalized_price,expires_at").gte("expires_at",new Date().toISOString()).limit(5000),
    admin.from("supplier_price_history").select("product_id,observed_price,created_at").order("created_at",{ascending:false}).limit(5000)
  ]);

  const ruleByCategory = new Map((rules ?? []).filter((r)=>r.active).map((r)=>[String(r.category_id),r]));
  const trustedIds = new Set((trusted ?? []).map((r)=>String(r.id)));
  const marketByProduct = new Map<string,number[]>();
  for (const row of observations ?? []) {
    if (!trustedIds.has(String(row.source_id))) continue;
    const list = marketByProduct.get(String(row.product_id)) ?? [];
    const value = Number(row.normalized_price);
    if (Number.isFinite(value) && value > 0) list.push(value);
    marketByProduct.set(String(row.product_id),list);
  }
  const lastObserved = new Map<string,number>();
  for (const row of history ?? []) {
    const key=String(row.product_id);
    if (!lastObserved.has(key)) lastObserved.set(key,Number(row.observed_price));
  }

  const summary = { checked:0, fetched:0, autoUpdated:0, review:0, unchanged:0, marketAlerts:0, skipped:0 };

  for (const raw of (sources ?? []) as unknown as SourceRow[]) {
    const product = Array.isArray(raw.product) ? raw.product[0] : raw.product;
    const supplier = Array.isArray(raw.supplier) ? raw.supplier[0] : raw.supplier;
    if (!product?.active || !supplier || !raw.source_url) { summary.skipped++; continue; }
    summary.checked++;

    const supplierHosts=[hostOf(supplier.website_url),hostOf(supplier.catalog_url)].filter(Boolean);
    if (!supplierHosts.length) { summary.skipped++; continue; }

    let observed:number|null=null;
    try {
      const url=await assertSafeSourceUrl(raw.source_url,supplierHosts);
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),6000);
      const response=await fetch(url,{
        headers:{"User-Agent":"FZAC-PriceMonitor/1.0 (+https://www.fzacmateriales.store)","Accept":"text/html,application/xhtml+xml"},
        redirect:"error",cache:"no-store",signal:controller.signal
      }).finally(()=>clearTimeout(timeout));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type=response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!type.includes("text/html") && !type.includes("application/xhtml")) throw new Error("Contenido no HTML");
      observed=extractPrice(await readBody(response));
      if (!observed) throw new Error("Precio no encontrado");
      summary.fetched++;
    } catch {
      summary.skipped++;
      continue;
    }

    const previousSource=Number(raw.original_price);
    const previousSeen=lastObserved.get(product.id) ?? previousSource;
    const changePct=previousSeen > 0 ? ((observed-previousSeen)/previousSeen)*100 : 0;
    const rule=ruleByCategory.get(String(product.category_id));
    const margin=Number(rule?.target_margin_pct ?? 5);
    const threshold=Number(rule?.auto_update_threshold_pct ?? 15);
    const marketAlert=Number(rule?.alert_over_market_pct ?? 15);
    const expected=Math.round(observed*(1+margin/100));
    const marketMedian=median(marketByProduct.get(product.id) ?? []);

    let action:"AUTO_UPDATED"|"REVIEW"|"UNCHANGED"="UNCHANGED";
    let reason="Sin cambio relevante.";

    if (Math.abs(changePct) > threshold) {
      action="REVIEW";
      reason=`Cambio de costo ${changePct.toFixed(1)}% supera el umbral ${threshold}% de la categoría.`;
      await admin.from("product_supplier_sources").update({
        original_price:observed,checked_at:new Date().toISOString(),manual_review_required:true,manual_review_reason:reason
      }).eq("id",raw.id);
      await admin.from("notifications").insert({
        target_role:"ADMIN",type:"PRICE_REVIEW_REQUIRED",title:`Revisar precio · ${product.name}`,
        message:reason,link_to:"/fzac-admin-crs-2026/auditoria-precios"
      });
      summary.review++;
    } else {
      const currentPrice=Number(product.price);
      const sourceChanged=Math.abs(observed-previousSource) >= 0.01;
      const saleChanged=Math.abs(currentPrice-expected) >= 1;
      if (sourceChanged || saleChanged) {
        action="AUTO_UPDATED";
        reason=`Costo actualizado ${changePct >= 0 ? "+" : ""}${changePct.toFixed(1)}%. Margen categoría: ${margin}%.`;
        await Promise.all([
          admin.from("product_supplier_sources").update({
            original_price:observed,margin_percent:margin,checked_at:new Date().toISOString(),
            manual_review_required:false,manual_review_reason:null
          }).eq("id",raw.id),
          admin.from("products").update({price:expected,updated_at:new Date().toISOString()}).eq("id",product.id)
        ]);
        summary.autoUpdated++;
      } else summary.unchanged++;
    }

    await admin.from("supplier_price_history").insert({
      product_id:product.id,supplier_id:raw.supplier_id,previous_price:previousSeen,observed_price:observed,
      change_pct:Number(changePct.toFixed(2)),action,reason
    });

    if (marketMedian && expected > marketMedian*(1+marketAlert/100)) {
      const { data: existing } = await admin.from("notifications").select("id")
        .eq("type","PRICE_MARKET_ALERT").eq("link_to",`/fzac-admin-crs-2026/auditoria-precios?product=${product.id}`)
        .eq("read",false).limit(1).maybeSingle();
      if (!existing?.id) {
        await admin.from("notifications").insert({
          target_role:"ADMIN",type:"PRICE_MARKET_ALERT",title:`Precio por encima de mercado · ${product.name}`,
          message:`FZAC ${expected.toLocaleString("es-AR")} vs mediana ${Math.round(marketMedian).toLocaleString("es-AR")}. Umbral: ${marketAlert}%.`,
          link_to:`/fzac-admin-crs-2026/auditoria-precios?product=${product.id}`
        });
        summary.marketAlerts++;
      }
    }
  }

  return summary;
}
