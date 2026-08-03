import { expect, test } from "@playwright/test";
import { analyzeMarketProduct, buildMarketPriceIntelligence } from "../../lib/market-pricing/analytics";
import { marketPriceApplySchema, marketFeedSchema } from "../../lib/validations/market-pricing";

const now = new Date("2026-08-02T12:00:00.000Z").getTime();
const product = { id: "product-1", name: "Cemento 50 kg", sku: "CEM-50", unit: "bolsa", price: 800 };

function observation(sourceId: string, price: number, input: Partial<{
  product_id: string;
  sale_unit: string;
  observed_at: string;
  expires_at: string;
  trusted: boolean;
}> = {}) {
  return {
    product_id: input.product_id ?? product.id,
    source_id: sourceId,
    normalized_price: price,
    sale_unit: input.sale_unit ?? "bolsas",
    observed_at: input.observed_at ?? "2026-08-01T12:00:00.000Z",
    expires_at: input.expires_at ?? "2026-08-09T12:00:00.000Z",
    source: { trusted: input.trusted ?? true }
  };
}

test.describe("Inteligencia de precios FZAC", () => {
  test("usa una sola lectura vigente por fuente y descarta valores extremos", () => {
    const analysis = analyzeMarketProduct(product, [
      observation("source-a", 900, { observed_at: "2026-07-31T12:00:00.000Z" }),
      observation("source-a", 1_000),
      observation("source-b", 1_050),
      observation("source-c", 5_000)
    ], now);

    expect(analysis.status).toBe("READY");
    expect(analysis.action).toBe("RAISE");
    expect(analysis.sources).toBe(3);
    expect(analysis.observations).toBe(2);
    expect(analysis.outliers).toBe(1);
    expect(analysis.median).toBe(1_025);
    expect(analysis.suggestedPrice).toBe(1_050);
    expect(analysis.confidence).toBeGreaterThanOrEqual(60);
  });

  test("no habilita decisiones con una sola fuente o unidades incompatibles", () => {
    const duplicateSource = analyzeMarketProduct(product, [
      observation("source-a", 1_000),
      observation("source-a", 1_050, { observed_at: "2026-08-02T10:00:00.000Z" })
    ], now);
    const incompatibleUnit = analyzeMarketProduct(product, [
      observation("source-a", 1_000),
      observation("source-b", 1_050, { sale_unit: "metro" })
    ], now);

    expect(duplicateSource.status).toBe("INSUFFICIENT");
    expect(duplicateSource.sources).toBe(1);
    expect(duplicateSource.suggestedPrice).toBeNull();
    expect(incompatibleUnit.status).toBe("INSUFFICIENT");
    expect(incompatibleUnit.sources).toBe(1);
  });

  test("resume decisiones sin inventar señales para productos sin evidencia", () => {
    const result = buildMarketPriceIntelligence([
      product,
      { id: "product-2", name: "Arena", sku: "ARENA", unit: "m3", price: 10_000 }
    ], [observation("source-a", 1_000), observation("source-b", 1_050)], now);

    expect(result.overview.products).toBe(2);
    expect(result.overview.ready).toBe(1);
    expect(result.overview.actionable).toBe(1);
    expect(result.overview.review).toBe(0);
    expect(result.overview.insufficient).toBe(1);
  });

  test("valida aprobación humana y contenido de feeds", () => {
    expect(marketPriceApplySchema.safeParse({
      action: "APPLY_PRICE",
      productId: "00000000-0000-4000-8000-000000000001",
      proposedPrice: "1050",
      expectedCurrentPrice: 800,
      reason: "Revisión de fuentes comparables"
    }).success).toBe(true);
    expect(marketPriceApplySchema.safeParse({
      action: "APPLY_PRICE",
      productId: "00000000-0000-4000-8000-000000000001",
      proposedPrice: 5_000,
      expectedCurrentPrice: 800,
      reason: "<script>alert(1)</script>"
    }).success).toBe(false);
    expect(marketFeedSchema.safeParse({ items: [{
      external_key: "cemento-50",
      fzac_sku: "CEM-50",
      name: "Cemento comparable",
      price: 1_000,
      currency: "ARS",
      sale_unit: "bolsa",
      equivalent_quantity: 1
    }] }).success).toBe(true);
  });
});
