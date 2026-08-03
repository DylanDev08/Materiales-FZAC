export type MarketAnalyticsProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  price: number | string;
};

export type MarketAnalyticsObservation = {
  product_id: string;
  source_id: string;
  normalized_price: number | string;
  sale_unit: string;
  observed_at: string;
  expires_at: string;
  source?: { trusted?: boolean } | null;
};

export type MarketPriceHistoryPoint = {
  date: string;
  median: number;
  observations: number;
};

export type MarketPriceAnalysis = {
  productId: string;
  productName: string;
  sku: string;
  saleUnit: string;
  status: "READY" | "INSUFFICIENT" | "ANOMALOUS";
  action: "KEEP" | "RAISE" | "LOWER" | "REVIEW";
  observations: number;
  sources: number;
  outliers: number;
  minimum: number | null;
  median: number | null;
  maximum: number | null;
  currentPrice: number;
  suggestedPrice: number | null;
  differencePercent: number | null;
  spreadPercent: number | null;
  trendPercent: number | null;
  confidence: number;
  observedAt: string | null;
  history: MarketPriceHistoryPoint[];
  reason: string;
};

export function normalizeMarketUnit(value: unknown) {
  const unit = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
  const aliases: Record<string, string> = {
    unidades: "unidad",
    un: "unidad",
    u: "unidad",
    bolsas: "bolsa",
    baldes: "balde",
    litros: "litro",
    l: "litro",
    kilos: "kg",
    kilo: "kg",
    kilogramo: "kg",
    kilogramos: "kg",
    metros: "metro",
    m: "metro"
  };
  return aliases[unit] ?? unit;
}

function numeric(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function median(values: number[]) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function commercialRound(value: number) {
  const step = value < 10_000 ? 50 : value < 100_000 ? 100 : 500;
  return Math.max(step, Math.round(value / step) * step);
}

function validDate(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function historyFor(observations: MarketAnalyticsObservation[], now: number) {
  const groups = new Map<string, number[]>();
  const oldest = now - 30 * 86_400_000;
  for (const row of observations) {
    const time = validDate(row.observed_at);
    const price = numeric(row.normalized_price);
    if (!row.source?.trusted || time < oldest || time > now + 300_000 || price <= 0) continue;
    const date = new Date(time).toISOString().slice(0, 10);
    const values = groups.get(date) ?? [];
    values.push(price);
    groups.set(date, values);
  }
  return Array.from(groups.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-14)
    .map(([date, values]) => ({ date, median: median(values), observations: values.length }));
}

export function analyzeMarketProduct(
  product: MarketAnalyticsProduct,
  observations: MarketAnalyticsObservation[],
  now = Date.now()
): MarketPriceAnalysis {
  const productUnit = normalizeMarketUnit(product.unit);
  const comparable = observations
    .filter((row) => row.product_id === product.id)
    .filter((row) => row.source?.trusted)
    .filter((row) => normalizeMarketUnit(row.sale_unit) === productUnit)
    .filter((row) => validDate(row.expires_at) >= now && validDate(row.observed_at) <= now + 300_000)
    .filter((row) => numeric(row.normalized_price) > 0)
    .sort((left, right) => validDate(right.observed_at) - validDate(left.observed_at));

  const latestBySource = new Map<string, MarketAnalyticsObservation>();
  for (const row of comparable) {
    if (!latestBySource.has(row.source_id)) latestBySource.set(row.source_id, row);
  }
  const latest = Array.from(latestBySource.values());
  const values = latest.map((row) => numeric(row.normalized_price));
  const history = historyFor(
    observations.filter((row) => row.product_id === product.id && normalizeMarketUnit(row.sale_unit) === productUnit),
    now
  );
  const currentPrice = numeric(product.price);

  if (values.length < 2) {
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      saleUnit: product.unit,
      status: "INSUFFICIENT",
      action: "REVIEW",
      observations: values.length,
      sources: latestBySource.size,
      outliers: 0,
      minimum: values.length ? values[0] : null,
      median: values.length ? values[0] : null,
      maximum: values.length ? values[0] : null,
      currentPrice,
      suggestedPrice: null,
      differencePercent: null,
      spreadPercent: null,
      trendPercent: null,
      confidence: values.length ? 35 : 0,
      observedAt: latest[0]?.observed_at ?? null,
      history,
      reason: "Se necesitan al menos dos fuentes verificadas, vigentes y comparables."
    };
  }

  const rawMedian = median(values);
  const deviations = values.map((value) => Math.abs(value - rawMedian));
  const mad = median(deviations);
  const outlierThreshold = Math.max(rawMedian * 0.35, mad * 3);
  const accepted = values.length >= 3
    ? values.filter((value) => Math.abs(value - rawMedian) <= outlierThreshold)
    : values;
  const outliers = values.length - accepted.length;
  const stableValues = accepted.length >= 2 ? accepted : values;
  const marketMedian = median(stableValues);
  const minimum = Math.min(...stableValues);
  const maximum = Math.max(...stableValues);
  const spreadPercent = marketMedian > 0 ? ((maximum - minimum) / marketMedian) * 100 : 0;
  const differencePercent = marketMedian > 0 ? ((currentPrice - marketMedian) / marketMedian) * 100 : null;
  const latestAgeDays = Math.max(0, (now - validDate(latest[0]?.observed_at ?? "")) / 86_400_000);
  const sourceScore = Math.min(70, latestBySource.size * 18);
  const recencyScore = latestAgeDays <= 2 ? 20 : latestAgeDays <= 7 ? 12 : 4;
  const spreadScore = spreadPercent <= 10 ? 10 : spreadPercent <= 25 ? 5 : 0;
  const confidence = Math.max(0, Math.min(99, Math.round(sourceScore + recencyScore + spreadScore - outliers * 8)));
  const trendPercent = history.length >= 2 && history[0].median > 0
    ? ((history.at(-1)!.median - history[0].median) / history[0].median) * 100
    : null;
  const anomalous = spreadPercent > 45 || outliers >= 2;
  const action = anomalous || confidence < 60 || differencePercent === null
    ? "REVIEW"
    : Math.abs(differencePercent) <= 5
      ? "KEEP"
      : differencePercent < 0
        ? "RAISE"
        : "LOWER";
  const suggestedPrice = action === "KEEP" ? currentPrice : action === "REVIEW" ? null : commercialRound(marketMedian);

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    saleUnit: product.unit,
    status: anomalous ? "ANOMALOUS" : "READY",
    action,
    observations: stableValues.length,
    sources: latestBySource.size,
    outliers,
    minimum,
    median: marketMedian,
    maximum,
    currentPrice,
    suggestedPrice,
    differencePercent,
    spreadPercent,
    trendPercent,
    confidence,
    observedAt: latest[0]?.observed_at ?? null,
    history,
    reason: anomalous
      ? "Las fuentes tienen una dispersion alta. Revisalas antes de tomar una decision."
      : action === "KEEP"
        ? "El precio FZAC se encuentra alineado con la mediana vigente."
        : `La propuesta usa la mediana de ${latestBySource.size} fuentes verificadas y redondeo comercial.`
  };
}

export function buildMarketPriceIntelligence(
  products: MarketAnalyticsProduct[],
  observations: MarketAnalyticsObservation[],
  now = Date.now()
) {
  const analyses = products
    .map((product) => analyzeMarketProduct(product, observations, now))
    .sort((left, right) => {
      const leftPriority = left.action === "REVIEW" ? 3 : left.action === "KEEP" ? 0 : 2;
      const rightPriority = right.action === "REVIEW" ? 3 : right.action === "KEEP" ? 0 : 2;
      return rightPriority - leftPriority || right.confidence - left.confidence || left.productName.localeCompare(right.productName, "es");
    });
  return {
    analyses,
    overview: {
      products: products.length,
      ready: analyses.filter((item) => item.status === "READY").length,
      actionable: analyses.filter((item) => item.action === "RAISE" || item.action === "LOWER").length,
      aligned: analyses.filter((item) => item.action === "KEEP").length,
      review: analyses.filter((item) => item.action === "REVIEW" && item.sources > 0).length,
      insufficient: analyses.filter((item) => item.status === "INSUFFICIENT").length,
      anomalous: analyses.filter((item) => item.status === "ANOMALOUS").length
    }
  };
}
