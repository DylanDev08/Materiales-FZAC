import assert from "node:assert/strict";
import test from "node:test";
import { createShippingQuoteService, parseShippingTariff } from "../../lib/shipping/service.ts";

const address = {
  street: "Córdoba",
  number: "1200",
  city: "Rosario",
  province: "Santa Fe",
  postalCode: "S2000"
};

const validEnvironment = {
  googleMapsServerKey: "server-key-for-tests",
  storeAddress: "Hermana Paula 3164, Rosario, Santa Fe, Argentina",
  basePrice: "1000",
  pricePerKm: "500",
  minPrice: "1800",
  roundTo: "100",
  maxKm: "30"
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function successfulRoute(distanceMeters = 2_000) {
  return jsonResponse([{
    status: { code: 0 },
    condition: "ROUTE_EXISTS",
    distanceMeters,
    duration: "600s"
  }]);
}

test("no consulta Google si falta la server key canónica", async () => {
  let calls = 0;
  const service = createShippingQuoteService({
    environment: { ...validEnvironment, googleMapsServerKey: "" },
    fetchImpl: async () => {
      calls += 1;
      return successfulRoute();
    }
  });

  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.equal(calls, 0);
  assert.match(quote.reason, /servicio de distancia/i);
});

test("no consulta Google si falta la dirección de origen", async () => {
  let calls = 0;
  const service = createShippingQuoteService({
    environment: { ...validEnvironment, storeAddress: "" },
    fetchImpl: async () => {
      calls += 1;
      return successfulRoute();
    }
  });

  assert.equal(service.getShippingConfigStatus().storeAddressConfigured, false);
  assert.equal(service.canQuoteShipping(), false);
  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.equal(calls, 0);
  assert.match(quote.reason, /dirección de origen/i);
});

test("no consume Google ni inventa importes si falta parte de la tarifa", async () => {
  let calls = 0;
  const service = createShippingQuoteService({
    environment: { ...validEnvironment, minPrice: "" },
    fetchImpl: async () => {
      calls += 1;
      return successfulRoute();
    }
  });

  assert.equal(service.getShippingConfigStatus().shippingTariffConfigured, false);
  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.equal(calls, 0);
  assert.match(quote.reason, /tarifa vigente/i);
});

test("calcula base más distancia, aplica mínimo y redondeo exclusivamente en servidor", async () => {
  const service = createShippingQuoteService({
    environment: validEnvironment,
    fetchImpl: async () => successfulRoute(2_000)
  });

  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, true);
  assert.equal(quote.amount, 2_000);
  assert.equal(quote.distanceKm, 2);
});

test("rechaza distancias fuera del radio máximo", async () => {
  const service = createShippingQuoteService({
    environment: validEnvironment,
    fetchImpl: async () => successfulRoute(30_001)
  });

  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.equal(quote.amount, 0);
  assert.match(quote.reason, /supera el radio/i);
});

for (const [status, pattern] of [
  [400, /dirección/i],
  [401, /rechazó/i],
  [403, /rechazó/i],
  [404, /dirección/i],
  [429, /límite/i],
  [500, /temporalmente/i]
]) {
  test(`falla cerrada y sin detalles internos ante Routes API ${status}`, async () => {
    const service = createShippingQuoteService({
      environment: validEnvironment,
      fetchImpl: async () => jsonResponse({ error: { message: "internal provider detail" } }, status)
    });

    const quote = await service.quoteDeliveryForAddress(address);
    assert.equal(quote.available, false);
    assert.match(quote.reason, pattern);
    assert.doesNotMatch(JSON.stringify(quote), /internal provider detail|server-key-for-tests/i);
  });
}

for (const reason of ["SERVICE_DISABLED", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED"]) {
  test(`redacta el detalle interno ${reason}`, async () => {
    const service = createShippingQuoteService({
      environment: validEnvironment,
      fetchImpl: async () => jsonResponse({ error: { details: [{ reason }] } }, 403)
    });
    const quote = await service.quoteDeliveryForAddress(address);
    assert.equal(quote.available, false);
    assert.doesNotMatch(JSON.stringify(quote), new RegExp(reason));
  });
}

test("convierte un timeout en error público controlado", async () => {
  const service = createShippingQuoteService({
    environment: validEnvironment,
    timeoutMs: 10,
    fetchImpl: async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    })
  });

  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.match(quote.reason, /no respondió a tiempo/i);
});

test("rechaza una respuesta corrupta sin filtrar contenido", async () => {
  const service = createShippingQuoteService({
    environment: validEnvironment,
    fetchImpl: async () => new Response("not-json-secret", { status: 200 })
  });

  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.doesNotMatch(JSON.stringify(quote), /not-json-secret/i);
});

test("rechaza ROUTE_NOT_FOUND y distanceMeters cero", async () => {
  for (const body of [
    [{ status: { code: 0 }, condition: "ROUTE_NOT_FOUND" }],
    [{ status: { code: 0 }, condition: "ROUTE_EXISTS", distanceMeters: 0 }]
  ]) {
    const service = createShippingQuoteService({
      environment: validEnvironment,
      fetchImpl: async () => jsonResponse(body)
    });
    const quote = await service.quoteDeliveryForAddress(address);
    assert.equal(quote.available, false);
    assert.equal(quote.amount, 0);
  }
});

test("rechaza tarifas negativas, NaN y cálculos que desbordan", async () => {
  assert.equal(parseShippingTariff({ ...validEnvironment, basePrice: "-1" }), null);
  assert.equal(parseShippingTariff({ ...validEnvironment, pricePerKm: "NaN" }), null);
  assert.equal(parseShippingTariff({ ...validEnvironment, roundTo: "0" }), null);

  const service = createShippingQuoteService({
    environment: { ...validEnvironment, pricePerKm: "1e308" },
    fetchImpl: async () => successfulRoute(30_000)
  });
  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(quote.available, false);
  assert.equal(quote.amount, 0);
});

test("reutiliza el cache para una dirección y tarifa idénticas", async () => {
  let calls = 0;
  const service = createShippingQuoteService({
    environment: validEnvironment,
    fetchImpl: async () => {
      calls += 1;
      return successfulRoute();
    }
  });

  await service.quoteDeliveryForAddress(address);
  await service.quoteDeliveryForAddress({ ...address });
  assert.equal(calls, 1);
});

test("deduplica solicitudes concurrentes para la misma dirección", async () => {
  let calls = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const service = createShippingQuoteService({
    environment: validEnvironment,
    fetchImpl: async () => {
      calls += 1;
      await gate;
      return successfulRoute();
    }
  });

  const first = service.quoteDeliveryForAddress(address);
  const second = service.quoteDeliveryForAddress(address);
  release();
  const [firstQuote, secondQuote] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(firstQuote, secondQuote);
});

test("usa field mask mínimo y nunca serializa la server key en la respuesta", async () => {
  let requestHeaders;
  const service = createShippingQuoteService({
    environment: validEnvironment,
    fetchImpl: async (_input, init) => {
      requestHeaders = new Headers(init?.headers);
      return successfulRoute();
    }
  });

  const quote = await service.quoteDeliveryForAddress(address);
  assert.equal(requestHeaders.get("X-Goog-Api-Key"), validEnvironment.googleMapsServerKey);
  assert.equal(requestHeaders.get("X-Goog-FieldMask"), "status,condition,distanceMeters,duration");
  assert.doesNotMatch(JSON.stringify(quote), new RegExp(validEnvironment.googleMapsServerKey));
});
