/**
 * Quote a local delivery by estimated transport time, including an estimated
 * return to the depot and unloading. One-way Google Routes duration is doubled
 * as an approximation, not a guarantee of the return route.
 */
export type HourlyShippingTariff = {
  hourlyRate: number;
  unloadMinutes: number;
  roundTo: number;
};

type UnloadingLine = {
  product: {
    specifications: Record<string, string | number | boolean>;
  };
  quantity: number;
};

/**
 * Only use explicitly configured per-SKU unloading estimates.
 * Missing, invalid or special-handling products require a manual shipping quote.
 * No estimated minutes are inferred from product names/categories.
 */
export function calculateCartUnloadingMinutes(lines: UnloadingLine[]): number | null {
  if (!lines.length || lines.length > 100) return null;
  let total = 0;
  for (const line of lines) {
    const specs = line.product.specifications ?? {};
    // Fail closed for invalid values such as the string "true" or "false".
    if (
      specs.shipping_requires_manual_quote !== undefined &&
      specs.shipping_requires_manual_quote !== false
    ) return null;
    const perUnit = specs.shipping_unload_minutes_per_unit;
    if (
      typeof perUnit !== "number" ||
      !Number.isFinite(perUnit) ||
      perUnit < 0 ||
      perUnit > 240 ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > 999
    ) return null;
    total += perUnit * line.quantity;
    // Large or complex loads need an individualized logistics quotation.
    if (total > 480) return null;
  }
  return total;
}

export function calculateHourlyShippingQuote(oneWaySeconds: number, tariff: HourlyShippingTariff) {
  const { hourlyRate, unloadMinutes, roundTo } = tariff;
  if (
    !Number.isFinite(oneWaySeconds) || oneWaySeconds <= 0 ||
    !Number.isFinite(hourlyRate) || hourlyRate <= 0 ||
    !Number.isFinite(unloadMinutes) || unloadMinutes < 0 ||
    !Number.isFinite(roundTo) || roundTo <= 0
  ) return null;

  const estimatedTotalMinutes = (2 * oneWaySeconds) / 60 + unloadMinutes;
  const billableMinutes = Math.max(60, estimatedTotalMinutes);
  const amount = Math.ceil(((billableMinutes / 60) * hourlyRate) / roundTo) * roundTo;
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    amount,
    estimatedTotalMinutes: Math.ceil(estimatedTotalMinutes),
    billableMinutes: Math.ceil(billableMinutes)
  };
}
