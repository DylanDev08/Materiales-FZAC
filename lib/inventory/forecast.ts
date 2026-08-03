export type InventoryForecastProduct = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  stock: number | string;
  stock_minimum: number | string;
  price: number | string;
  categoryName?: string | null;
};

export type InventorySaleMovement = {
  product_id: string;
  quantity: number | string;
  created_at: string;
};

export type InventoryPendingDemand = {
  product_id: string;
  quantity: number | string;
};

export type InventoryForecastStatus = "OUT_OF_STOCK" | "CRITICAL" | "REORDER" | "HEALTHY" | "NO_HISTORY";

export type InventoryForecastRow = {
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  categoryName: string;
  stock: number;
  minimumStock: number;
  unitsSold: number;
  salesEvents: number;
  recentUnitsSold: number;
  pendingUnits: number;
  availableAfterPending: number;
  averageDailyDemand: number;
  trendPercent: number | null;
  coverageDays: number | null;
  estimatedStockoutAt: string | null;
  reorderPoint: number;
  targetStock: number;
  suggestedOrder: number;
  confidence: "HIGH" | "MEDIUM" | "LOW" | "NONE";
  status: InventoryForecastStatus;
  reason: string;
};

function numeric(value: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function validTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function roundDemand(value: number) {
  return Math.round(value * 100) / 100;
}

function isoDay(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

export function buildInventoryForecast(input: {
  products: InventoryForecastProduct[];
  sales: InventorySaleMovement[];
  pendingDemand: InventoryPendingDemand[];
  rangeDays: 30 | 60 | 90;
  now?: number;
  leadTimeDays?: number;
  safetyDays?: number;
  targetCoverageDays?: number;
  truncated?: boolean;
}) {
  const now = input.now ?? Date.now();
  const dayMs = 86_400_000;
  const rangeStart = now - input.rangeDays * dayMs;
  const recentStart = now - 7 * dayMs;
  const previousStart = now - 30 * dayMs;
  const leadTimeDays = Math.max(1, Math.min(60, input.leadTimeDays ?? 7));
  const safetyDays = Math.max(0, Math.min(30, input.safetyDays ?? 5));
  const targetCoverageDays = Math.max(7, Math.min(120, input.targetCoverageDays ?? 30));
  const salesByProduct = new Map<string, InventorySaleMovement[]>();
  const pendingByProduct = new Map<string, number>();
  const activeProductIds = new Set(input.products.map((product) => product.id));

  for (const movement of input.sales) {
    const time = validTime(movement.created_at);
    if (!activeProductIds.has(movement.product_id) || time < rangeStart || time > now + 300_000) continue;
    const quantity = Math.abs(numeric(movement.quantity));
    if (quantity <= 0) continue;
    const rows = salesByProduct.get(movement.product_id) ?? [];
    rows.push({ ...movement, quantity });
    salesByProduct.set(movement.product_id, rows);
  }

  for (const item of input.pendingDemand) {
    const quantity = Math.max(0, numeric(item.quantity));
    if (!activeProductIds.has(item.product_id) || quantity <= 0) continue;
    pendingByProduct.set(item.product_id, (pendingByProduct.get(item.product_id) ?? 0) + quantity);
  }

  const rows: InventoryForecastRow[] = input.products.map((product) => {
    const stock = Math.max(0, Math.floor(numeric(product.stock)));
    const minimumStock = Math.max(0, Math.floor(numeric(product.stock_minimum)));
    const movements = salesByProduct.get(product.id) ?? [];
    const unitsSold = movements.reduce((sum, movement) => sum + numeric(movement.quantity), 0);
    const recentUnitsSold = movements
      .filter((movement) => validTime(movement.created_at) >= recentStart)
      .reduce((sum, movement) => sum + numeric(movement.quantity), 0);
    const previousUnits = movements
      .filter((movement) => {
        const time = validTime(movement.created_at);
        return time >= previousStart && time < recentStart;
      })
      .reduce((sum, movement) => sum + numeric(movement.quantity), 0);
    const pendingUnits = Math.ceil(pendingByProduct.get(product.id) ?? 0);
    const availableAfterPending = stock - pendingUnits;
    const baseDaily = unitsSold / input.rangeDays;
    const recentDaily = recentUnitsSold / 7;
    const previousDaily = previousUnits / 23;
    const rawDemand = recentUnitsSold > 0 ? recentDaily * 0.65 + baseDaily * 0.35 : baseDaily;
    const cappedDemand = baseDaily > 0 ? Math.min(rawDemand, baseDaily * 2.5) : 0;
    const averageDailyDemand = roundDemand(cappedDemand);
    const trendPercent = previousDaily > 0
      ? Math.max(-999, Math.min(999, ((recentDaily - previousDaily) / previousDaily) * 100))
      : null;
    const coverageDays = averageDailyDemand > 0 ? Math.max(0, availableAfterPending / averageDailyDemand) : null;
    const demandReorderPoint = Math.ceil(averageDailyDemand * (leadTimeDays + safetyDays));
    const reorderPoint = Math.max(minimumStock, demandReorderPoint);
    const targetStock = averageDailyDemand > 0
      ? Math.max(minimumStock * 2, Math.ceil(averageDailyDemand * (leadTimeDays + targetCoverageDays)))
      : Math.max(minimumStock * 2, minimumStock);
    const suggestedOrder = Math.max(0, targetStock - Math.max(0, availableAfterPending));
    const estimatedStockoutAt = averageDailyDemand > 0 && availableAfterPending > 0
      ? new Date(now + Math.ceil(availableAfterPending / averageDailyDemand) * dayMs).toISOString()
      : averageDailyDemand > 0
        ? new Date(now).toISOString()
        : null;
    const confidence: InventoryForecastRow["confidence"] = unitsSold <= 0
      ? "NONE"
      : movements.length >= 10 && unitsSold >= 20 && input.rangeDays >= 60
        ? "HIGH"
        : movements.length >= 3 && unitsSold >= 5
          ? "MEDIUM"
          : "LOW";

    let status: InventoryForecastStatus;
    let reason: string;
    if (stock <= 0 || availableAfterPending <= 0) {
      status = "OUT_OF_STOCK";
      reason = pendingUnits > stock
        ? "Los pedidos pendientes superan el stock disponible. Revisá antes de aprobarlos."
        : "El producto no tiene unidades disponibles.";
    } else if ((coverageDays !== null && coverageDays <= leadTimeDays) || stock <= Math.max(1, Math.floor(minimumStock / 2))) {
      status = "CRITICAL";
      reason = "La cobertura estimada no alcanza el plazo normal de reposición.";
    } else if (stock <= reorderPoint || (coverageDays !== null && coverageDays <= leadTimeDays + safetyDays)) {
      status = "REORDER";
      reason = averageDailyDemand > 0
        ? "El stock alcanzó el punto de reposición calculado con ventas confirmadas."
        : "El stock está en el mínimo definido por FZAC, aunque todavía no hay historial suficiente.";
    } else if (unitsSold <= 0) {
      status = "NO_HISTORY";
      reason = "No hubo ventas confirmadas en el período; no se proyecta demanda sin evidencia.";
    } else {
      status = "HEALTHY";
      reason = "La cobertura actual supera el punto de reposición estimado.";
    }

    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      unit: product.unit,
      categoryName: product.categoryName ?? "Sin categoría",
      stock,
      minimumStock,
      unitsSold: Math.round(unitsSold),
      salesEvents: movements.length,
      recentUnitsSold: Math.round(recentUnitsSold),
      pendingUnits,
      availableAfterPending,
      averageDailyDemand,
      trendPercent: trendPercent === null ? null : Math.round(trendPercent * 10) / 10,
      coverageDays: coverageDays === null ? null : Math.round(coverageDays * 10) / 10,
      estimatedStockoutAt,
      reorderPoint,
      targetStock,
      suggestedOrder: status === "HEALTHY" || status === "NO_HISTORY" ? 0 : suggestedOrder,
      confidence,
      status,
      reason
    };
  }).sort((left, right) => {
    const priority: Record<InventoryForecastStatus, number> = { OUT_OF_STOCK: 5, CRITICAL: 4, REORDER: 3, NO_HISTORY: 1, HEALTHY: 0 };
    return priority[right.status] - priority[left.status]
      || right.pendingUnits - left.pendingUnits
      || (left.coverageDays ?? Number.MAX_SAFE_INTEGER) - (right.coverageDays ?? Number.MAX_SAFE_INTEGER)
      || left.productName.localeCompare(right.productName, "es");
  });

  const chartDays = Math.min(input.rangeDays, 30);
  const dailyTotals = new Map<string, number>();
  for (const movement of input.sales) {
    const time = validTime(movement.created_at);
    if (!activeProductIds.has(movement.product_id) || time < now - chartDays * dayMs || time > now + 300_000) continue;
    const date = isoDay(time);
    dailyTotals.set(date, (dailyTotals.get(date) ?? 0) + Math.abs(numeric(movement.quantity)));
  }
  const dailyDemand = Array.from({ length: chartDays }, (_, index) => {
    const date = isoDay(now - (chartDays - 1 - index) * dayMs);
    return { date, units: Math.round((dailyTotals.get(date) ?? 0) * 100) / 100 };
  });

  return {
    generatedAt: new Date(now).toISOString(),
    rangeDays: input.rangeDays,
    policy: { leadTimeDays, safetyDays, targetCoverageDays },
    truncated: Boolean(input.truncated),
    overview: {
      products: rows.length,
      outOfStock: rows.filter((row) => row.status === "OUT_OF_STOCK").length,
      critical: rows.filter((row) => row.status === "CRITICAL").length,
      reorder: rows.filter((row) => row.status === "REORDER").length,
      healthy: rows.filter((row) => row.status === "HEALTHY").length,
      withoutHistory: rows.filter((row) => row.status === "NO_HISTORY").length,
      pendingUnits: rows.reduce((sum, row) => sum + row.pendingUnits, 0),
      suggestedUnits: rows.reduce((sum, row) => sum + row.suggestedOrder, 0),
      unitsSold: rows.reduce((sum, row) => sum + row.unitsSold, 0)
    },
    dailyDemand,
    rows
  };
}

export type InventoryForecastResult = ReturnType<typeof buildInventoryForecast>;
