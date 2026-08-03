import "server-only";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  analyzeMarketProduct,
  buildMarketPriceIntelligence,
  normalizeMarketUnit,
  type MarketAnalyticsObservation,
  type MarketAnalyticsProduct
} from "@/lib/market-pricing/analytics";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { marketFeedSchema } from "@/lib/validations/market-pricing";
import type { Product } from "@/types/domain";

type MarketObservationRow = {
  id: string;
  product_id: string;
  source_id: string;
  external_name: string;
  source_url: string | null;
  observed_price: number | string;
  normalized_price: number | string;
  currency: string;
  sale_unit: string;
  equivalent_quantity: number | string;
  observed_at: string;
  expires_at: string;
  source?: { name?: string; slug?: string; trusted?: boolean } | null;
  product?: { name?: string; sku?: string; unit?: string; price?: number | string } | null;
};

export type MarketPriceSummary = {
  status: "READY" | "INSUFFICIENT" | "UNAVAILABLE";
  productId: string;
  saleUnit: string;
  observations: number;
  sources: number;
  minimum: number | null;
  median: number | null;
  maximum: number | null;
  fzacPrice: number;
  differencePercent: number | null;
  position: "BELOW" | "ALIGNED" | "ABOVE" | null;
  observedAt: string | null;
  confidence: number;
  spreadPercent: number | null;
  suggestedPrice: number | null;
  outliers: number;
};

export async function getMarketPriceSummary(product: Pick<Product, "id" | "price" | "unit">): Promise<MarketPriceSummary> {
  const empty: MarketPriceSummary = {
    status: "UNAVAILABLE",
    productId: product.id,
    saleUnit: product.unit,
    observations: 0,
    sources: 0,
    minimum: null,
    median: null,
    maximum: null,
    fzacPrice: Number(product.price),
    differencePercent: null,
    position: null,
    observedAt: null,
    confidence: 0,
    spreadPercent: null,
    suggestedPrice: null,
    outliers: 0
  };
  const admin = getSupabaseAdminClient();
  if (!admin) return empty;
  const { data: trustedSources, error: sourceError } = await admin
    .from("market_price_sources")
    .select("id")
    .eq("active", true)
    .eq("trusted", true)
    .limit(100);
  const trustedSourceIds = (trustedSources ?? []).map((source) => source.id);
  if (sourceError || !trustedSourceIds.length) return empty;
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("market_price_observations")
    .select("source_id,normalized_price,sale_unit,observed_at,expires_at")
    .eq("product_id", product.id)
    .in("source_id", trustedSourceIds)
    .gte("expires_at", now)
    .order("observed_at", { ascending: false })
    .limit(100);
  if (error) return empty;

  const analysis = analyzeMarketProduct(
    { id: product.id, name: "Producto FZAC", sku: "", unit: product.unit, price: product.price },
    (data ?? []).map((row) => ({ ...row, product_id: product.id, source: { trusted: true } })),
    Date.now()
  );
  if (analysis.median === null) return { ...empty, status: "INSUFFICIENT" };
  return {
    status: analysis.status === "READY" ? "READY" : "INSUFFICIENT",
    productId: product.id,
    saleUnit: product.unit,
    observations: analysis.observations,
    sources: analysis.sources,
    minimum: analysis.minimum,
    median: analysis.median,
    maximum: analysis.maximum,
    fzacPrice: Number(product.price),
    differencePercent: analysis.differencePercent,
    position: analysis.action === "RAISE" ? "BELOW" : analysis.action === "LOWER" ? "ABOVE" : analysis.action === "KEEP" ? "ALIGNED" : null,
    observedAt: analysis.observedAt,
    confidence: analysis.confidence,
    spreadPercent: analysis.spreadPercent,
    suggestedPrice: analysis.suggestedPrice,
    outliers: analysis.outliers
  };
}

export async function getMarketPriceAdminData() {
  const admin = getSupabaseAdminClient();
  if (!admin) return { sources: [], observations: [], runs: [], products: [] };
  const [sources, observations, runs, products] = await Promise.all([
    admin.from("market_price_sources").select("*").order("name").limit(100),
    admin
      .from("market_price_observations")
      .select("*,source:market_price_sources(name,slug,trusted),product:products(name,sku,unit,price)")
      .order("observed_at", { ascending: false })
      .limit(200),
    admin.from("market_price_sync_runs").select("*,source:market_price_sources(name,slug)").order("started_at", { ascending: false }).limit(30),
    admin.from("products").select("id,name,sku,unit,price").eq("active", true).order("name").limit(500)
  ]);
  const observationRows = (observations.data ?? []) as unknown as MarketObservationRow[];
  const productRows = (products.data ?? []) as unknown as MarketAnalyticsProduct[];
  const intelligence = buildMarketPriceIntelligence(productRows, observationRows as unknown as MarketAnalyticsObservation[]);
  return {
    sources: sources.data ?? [],
    observations: observationRows,
    runs: runs.data ?? [],
    products: productRows,
    ...intelligence
  };
}

function observationFingerprint(input: {
  sourceId: string;
  externalKey: string;
  observedPrice: number;
  equivalentQuantity: number;
  observedAt: string;
}) {
  return createHash("sha256")
    .update([input.sourceId, input.externalKey, input.observedPrice, input.equivalentQuantity, input.observedAt.slice(0, 10)].join("|"))
    .digest("hex");
}

type MarketObservationInput = {
  productId: string;
  sourceId: string;
  externalKey: string;
  externalName: string;
  sourceUrl?: string | null;
  observedPrice: number;
  saleUnit: string;
  equivalentQuantity: number;
  observedAt?: string;
  expiresAt?: string;
  createdBy?: string | null;
};

function buildObservationRow(input: MarketObservationInput) {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const expiresAt = input.expiresAt ?? new Date(new Date(observedAt).getTime() + 7 * 86_400_000).toISOString();
  return {
    product_id: input.productId,
    source_id: input.sourceId,
    external_key: input.externalKey,
    external_name: input.externalName,
    source_url: input.sourceUrl ?? null,
    observed_price: input.observedPrice,
    currency: "ARS",
    sale_unit: normalizeMarketUnit(input.saleUnit),
    equivalent_quantity: input.equivalentQuantity,
    observed_at: observedAt,
    expires_at: expiresAt,
    fingerprint: observationFingerprint({
      sourceId: input.sourceId,
      externalKey: input.externalKey,
      observedPrice: input.observedPrice,
      equivalentQuantity: input.equivalentQuantity,
      observedAt
    }),
    metadata: { origin: input.createdBy ? "ADMIN" : "FEED" },
    created_by: input.createdBy ?? null
  };
}

export async function saveMarketObservation(input: MarketObservationInput) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Backend administrativo no disponible.");
  const { data, error } = await admin
    .from("market_price_observations")
    .upsert(buildObservationRow(input), { onConflict: "fingerprint" })
    .select("id")
    .single();
  if (error) throw new Error("No pudimos guardar la referencia de mercado.");
  return data;
}

function allowedMarketHosts() {
  return new Set(
    String(process.env.MARKET_PRICE_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function feedTokens() {
  try {
    const value = JSON.parse(process.env.MARKET_PRICE_FEED_TOKENS_JSON ?? "{}") as Record<string, unknown>;
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

function isSafeRemoteHost(hostname: string) {
  const host = hostname.trim().toLowerCase();
  return Boolean(host)
    && isIP(host) === 0
    && host !== "localhost"
    && !host.endsWith(".localhost")
    && !host.endsWith(".local");
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") || /^(fe8|fe9|fea|feb)/.test(normalized)) {
    return true;
  }
  const ipv4 = normalized.startsWith("::ffff:") ? normalized.slice(7) : normalized;
  const parts = ipv4.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 0
    || parts[0] === 10
    || parts[0] === 127
    || parts[0] >= 224
    || (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127)
    || (parts[0] === 169 && parts[1] === 254)
    || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
    || (parts[0] === 192 && parts[1] === 168)
    || (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19));
}

async function assertSafeFeedUrl(url: URL, hosts: Set<string>, resolvedHosts: Set<string>) {
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || (url.port && url.port !== "443")
    || !isSafeRemoteHost(hostname)
    || !hosts.has(hostname)
  ) {
    throw new Error("Host no autorizado.");
  }
  if (resolvedHosts.has(hostname)) return;
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("La fuente resuelve a una red no permitida.");
  }
  resolvedHosts.add(hostname);
}

async function readLimitedBody(response: Response, maximumBytes = 1_000_000) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error("La respuesta del feed supera el limite permitido.");
  }
  if (!response.body) throw new Error("La fuente no devolvio contenido.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let body = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maximumBytes) {
      await reader.cancel();
      throw new Error("La respuesta del feed supera el limite permitido.");
    }
    body += decoder.decode(value, { stream: true });
  }
  return body + decoder.decode();
}

export async function syncMarketPriceFeeds() {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Backend administrativo no disponible.");
  const hosts = allowedMarketHosts();
  const resolvedHosts = new Set<string>();
  const tokens = feedTokens();
  const { data: sources, error } = await admin
    .from("market_price_sources")
    .select("id,slug,name,feed_url")
    .eq("active", true)
    .eq("source_type", "API_JSON")
    .limit(20);
  if (error) throw new Error("No pudimos cargar las fuentes automáticas.");
  const { data: products } = await admin.from("products").select("id,sku").eq("active", true).limit(1000);
  const productsBySku = new Map((products ?? []).map((product) => [String(product.sku).toLowerCase(), String(product.id)]));
  const summary = { sources: sources?.length ?? 0, completed: 0, imported: 0, rejected: 0, skipped: 0 };

  for (const source of sources ?? []) {
    const startedAt = new Date().toISOString();
    const { data: run } = await admin
      .from("market_price_sync_runs")
      .insert({ source_id: source.id, status: "RUNNING", started_at: startedAt })
      .select("id")
      .single();
    const runId = run?.id;
    try {
      if (!source.feed_url) throw new Error("La fuente no tiene feed configurado.");
      const url = new URL(source.feed_url);
      try {
        await assertSafeFeedUrl(url, hosts, resolvedHosts);
      } catch {
        summary.skipped += 1;
        if (runId) {
          await admin.from("market_price_sync_runs").update({ status: "SKIPPED", error_message: "Host no autorizado.", finished_at: new Date().toISOString() }).eq("id", runId);
        }
        continue;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7_000);
      const response = await fetch(url, {
        headers: tokens[source.slug] ? { Authorization: `Bearer ${tokens[source.slug]}` } : {},
        redirect: "error",
        cache: "no-store",
        signal: controller.signal
      }).finally(() => clearTimeout(timeout));
      if (!response.ok) throw new Error(`La fuente respondió HTTP ${response.status}.`);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("application/json") && !contentType.includes("+json")) {
        throw new Error("La fuente no devolvio JSON.");
      }
      const text = await readLimitedBody(response);
      if (text.length > 1_000_000) throw new Error("La respuesta del feed supera el límite permitido.");
      const feed = marketFeedSchema.parse(JSON.parse(text));
      const rows: ReturnType<typeof buildObservationRow>[] = [];
      let rejected = 0;
      for (const item of feed.items) {
        const productId = productsBySku.get(item.fzac_sku.toLowerCase());
        if (!productId) {
          rejected += 1;
          continue;
        }
        if (item.url) {
          const itemUrl = new URL(item.url);
          try {
            await assertSafeFeedUrl(itemUrl, hosts, resolvedHosts);
          } catch {
            rejected += 1;
            continue;
          }
        }
        rows.push(buildObservationRow({
          productId,
          sourceId: source.id,
          externalKey: item.external_key,
          externalName: item.name,
          sourceUrl: item.url,
          observedPrice: item.price,
          saleUnit: item.sale_unit,
          equivalentQuantity: item.equivalent_quantity,
          observedAt: item.observed_at
        }));
      }
      if (rows.length) {
        const { error: importError } = await admin
          .from("market_price_observations")
          .upsert(rows, { onConflict: "fingerprint" });
        if (importError) throw new Error("No pudimos guardar el lote de referencias.");
      }
      const imported = rows.length;
      summary.completed += 1;
      summary.imported += imported;
      summary.rejected += rejected;
      if (runId) {
        await admin.from("market_price_sync_runs").update({ status: "COMPLETED", imported_count: imported, rejected_count: rejected, finished_at: new Date().toISOString() }).eq("id", runId);
      }
    } catch (syncError) {
      summary.rejected += 1;
      if (runId) {
        await admin.from("market_price_sync_runs").update({
          status: "FAILED",
          rejected_count: 1,
          error_message: syncError instanceof Error ? syncError.message.slice(0, 300) : "Error de sincronizacion.",
          finished_at: new Date().toISOString()
        }).eq("id", runId);
      }
    }
  }
  return summary;
}

export async function applyMarketPriceSuggestion(input: {
  productId: string;
  proposedPrice: number;
  expectedCurrentPrice: number;
  reason: string;
  actorId: string;
  actorEmail: string;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("Backend administrativo no disponible.");
  const { data: product, error: productError } = await admin
    .from("products")
    .select("id,name,sku,unit,price,active")
    .eq("id", input.productId)
    .eq("active", true)
    .maybeSingle();
  if (productError || !product) throw new Error("El producto ya no esta disponible.");

  const currentPrice = Number(product.price);
  if (!Number.isFinite(currentPrice) || Math.abs(currentPrice - input.expectedCurrentPrice) > 0.01) {
    throw new Error("El precio cambio mientras revisabas la propuesta. Actualiza la pantalla antes de continuar.");
  }
  const evidence = await getMarketPriceSummary({ id: product.id, price: currentPrice, unit: product.unit });
  if (evidence.status !== "READY" || evidence.median === null || evidence.confidence < 60 || evidence.position === "ALIGNED") {
    throw new Error("La evidencia vigente no alcanza para aplicar esta propuesta.");
  }
  const deviation = Math.abs(input.proposedPrice - evidence.median) / evidence.median;
  if (deviation > 0.15) {
    throw new Error("El precio propuesto se aleja mas de 15% de la mediana verificada.");
  }
  if (Math.abs(input.proposedPrice - currentPrice) < 0.01) {
    throw new Error("El precio propuesto es igual al precio actual.");
  }

  const { data: updated, error: updateError } = await admin
    .from("products")
    .update({ price: input.proposedPrice, updated_at: new Date().toISOString() })
    .eq("id", product.id)
    .eq("price", product.price)
    .select("id,name,sku,unit,price,updated_at")
    .maybeSingle();
  if (updateError || !updated) {
    throw new Error("El producto fue modificado por otra operacion. Actualiza la pantalla e intenta nuevamente.");
  }

  await admin.from("admin_audit_logs").insert({
    actor_id: input.actorId,
    actor_email: input.actorEmail,
    action: "MARKET_PRICE_SUGGESTION_APPLIED",
    entity: "products",
    entity_id: product.id,
    message: `Precio revisado de ${currentPrice} a ${input.proposedPrice}. ${input.reason}`.slice(0, 500)
  });
  return { product: updated, previousPrice: currentPrice, evidence };
}
