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
