import assert from "node:assert/strict";
import test from "node:test";
import { calculateCartUnloadingMinutes, calculateHourlyShippingQuote } from "../../lib/shipping/hourly-pricing.ts";

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
  assert.equal(quote?.amount, 60_670);
});

test("sin duracion valida o tarifa aprobada no se emite cotizacion", () => {
  assert.equal(calculateHourlyShippingQuote(0, tariff), null);
  assert.equal(calculateHourlyShippingQuote(NaN, tariff), null);
  assert.equal(calculateHourlyShippingQuote(10, { ...tariff, hourlyRate: 0 }), null);
  assert.equal(calculateHourlyShippingQuote(10, { ...tariff, unloadMinutes: -1 }), null);
});

test("suma tiempos especificos de descarga multiplicados por cantidades", () => {
  const items = [
    { product: { specifications: { shipping_unload_minutes_per_unit: 3 } }, quantity: 4 },
    { product: { specifications: { shipping_unload_minutes_per_unit: 8 } }, quantity: 2 }
  ];
  assert.equal(calculateCartUnloadingMinutes(items), 28);
});

test("un pedido mixto sin datos completos requiere presupuesto manual", () => {
  const items = [
    { product: { specifications: { shipping_unload_minutes_per_unit: 4 } }, quantity: 1 },
    { product: { specifications: {} }, quantity: 5 }
  ];
  assert.equal(calculateCartUnloadingMinutes(items), null);
});

test("material voluminoso bloquea cotizacion automatica", () => {
  const items = [{
    product: { specifications: { shipping_unload_minutes_per_unit: 10, shipping_requires_manual_quote: true } },
    quantity: 1
  }];
  assert.equal(calculateCartUnloadingMinutes(items), null);
});

test("no inventa tiempo de descarga y limita tiempos excesivos", () => {
  assert.equal(calculateCartUnloadingMinutes([]), null);
  assert.equal(calculateCartUnloadingMinutes([{ product: { specifications: {} }, quantity: 1 }]), null);
  assert.equal(calculateCartUnloadingMinutes([{ product: { specifications: { shipping_unload_minutes_per_unit: 241 } }, quantity: 1 }]), null);
  assert.equal(calculateCartUnloadingMinutes([{ product: { specifications: { shipping_unload_minutes_per_unit: 120 } }, quantity: 5 }]), null);
});
