import assert from "node:assert/strict";
import test from "node:test";
import { calculateHourlyShippingQuote } from "../../lib/shipping/hourly-pricing.ts";

const tariff = { hourlyRate: 40_000, unloadMinutes: 20, roundTo: 10 };

test("cobro minimo de una hora incluye ida, descarga y regreso", () => {
  const quote = calculateHourlyShippingQuote(20 * 60, tariff);
  assert.deepEqual(quote, { amount: 40_000, estimatedTotalMinutes: 60, billableMinutes: 60 });
});

test("90 minutos totales se cobran proporcionalmente", () => {
  const quote = calculateHourlyShippingQuote(30 * 60, { ...tariff, unloadMinutes: 30 });
  assert.deepEqual(quote, { amount: 60_000, estimatedTotalMinutes: 90, billableMinutes: 90 });
});

test("tarifa de hora real y redondeo monetario no subfacturan", () => {
  const quote = calculateHourlyShippingQuote(31 * 60, { ...tariff, unloadMinutes: 29, hourlyRate: 40_001 });
  assert.equal(quote?.estimatedTotalMinutes, 91);
  assert.equal(quote?.amount, 60_680);
});

test("sin duracion valida o tarifa aprobada no se emite cotizacion", () => {
  assert.equal(calculateHourlyShippingQuote(0, tariff), null);
  assert.equal(calculateHourlyShippingQuote(NaN, tariff), null);
  assert.equal(calculateHourlyShippingQuote(10, { ...tariff, hourlyRate: 0 }), null);
  assert.equal(calculateHourlyShippingQuote(10, { ...tariff, unloadMinutes: -1 }), null);
});
