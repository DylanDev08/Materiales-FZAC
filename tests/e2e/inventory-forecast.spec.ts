import { expect, test } from "@playwright/test";
import { buildInventoryForecast, type InventoryForecastProduct } from "../../lib/inventory/forecast";

const now = Date.UTC(2026, 7, 3, 12);
const day = 86_400_000;

function product(overrides: Partial<InventoryForecastProduct> = {}): InventoryForecastProduct {
  return {
    id: "product-1",
    name: "Cemento FZAC",
    sku: "CEM-001",
    unit: "bolsa",
    stock: 20,
    stock_minimum: 4,
    price: 10_000,
    categoryName: "Obra gruesa",
    ...overrides
  };
}

test.describe("Pronostico de inventario", () => {
  test("separa ventas confirmadas de demanda pendiente y recomienda sin modificar stock", () => {
    const result = buildInventoryForecast({
      products: [product({ stock: 10 })],
      sales: Array.from({ length: 10 }, (_, index) => ({
        product_id: "product-1",
        quantity: -2,
        created_at: new Date(now - (index + 1) * day).toISOString()
      })),
      pendingDemand: [{ product_id: "product-1", quantity: 3 }],
      rangeDays: 30,
      now
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ stock: 10, unitsSold: 20, pendingUnits: 3, availableAfterPending: 7 });
    expect(result.rows[0].suggestedOrder).toBeGreaterThan(0);
    expect(["CRITICAL", "REORDER"]).toContain(result.rows[0].status);
  });

  test("no inventa demanda ni una compra sugerida cuando no existe historial", () => {
    const result = buildInventoryForecast({
      products: [product()],
      sales: [],
      pendingDemand: [],
      rangeDays: 30,
      now
    });

    expect(result.rows[0]).toMatchObject({
      status: "NO_HISTORY",
      averageDailyDemand: 0,
      suggestedOrder: 0,
      confidence: "NONE"
    });
  });

  test("marca riesgo inmediato si los pedidos pendientes superan el stock", () => {
    const result = buildInventoryForecast({
      products: [product({ stock: 4 })],
      sales: [],
      pendingDemand: [{ product_id: "product-1", quantity: 6 }],
      rangeDays: 30,
      now
    });

    expect(result.rows[0]).toMatchObject({ status: "OUT_OF_STOCK", availableAfterPending: -2, pendingUnits: 6 });
  });

  test("limita picos aislados y excluye movimientos de productos inactivos", () => {
    const result = buildInventoryForecast({
      products: [product({ stock: 100 })],
      sales: [
        { product_id: "product-1", quantity: -50, created_at: new Date(now - day).toISOString() },
        { product_id: "product-1", quantity: -10, created_at: new Date(now - 20 * day).toISOString() },
        { product_id: "inactive-product", quantity: -500, created_at: new Date(now - day).toISOString() }
      ],
      pendingDemand: [{ product_id: "inactive-product", quantity: 500 }],
      rangeDays: 60,
      now
    });

    expect(result.rows[0].unitsSold).toBe(60);
    expect(result.rows[0].pendingUnits).toBe(0);
    expect(result.rows[0].averageDailyDemand).toBe(2.5);
    expect(result.overview.unitsSold).toBe(60);
    expect(result.dailyDemand.reduce((sum, point) => sum + point.units, 0)).toBe(60);
  });
});
