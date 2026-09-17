import { createHash } from "node:crypto";
import type { AddressPayload } from "@/types/domain";

type RouteMatrixElement = {
  status?: { code?: number };
  condition?: "ROUTE_EXISTS" | "ROUTE_NOT_FOUND";
  distanceMeters?: number;
  duration?: string;
};

type GoogleRoutesError = {
  error?: {
    details?: Array<{ reason?: string }>;
  };
};

type ShippingTariff = {
  base: number;
  perKm: number;
  min: number;
  roundTo: number;
  maxKm: number;
};

export type ShippingEnvironment = {
  googleMapsServerKey?: string;
  storeAddress?: string;
  basePrice?: string;
  pricePerKm?: string;
  minPrice?: string;
  roundTo?: string;
  maxKm?: string;
};

export type ShippingQuote =
  | {
      available: true;
      amount: number;
      distanceKm: number;
      durationText: string;
      origin: string;
      destination: string;
      provider: "GOOGLE_ROUTES";
    }
  | {
      available: false;
      amount: 0;
      reason: string;
      distanceKm?: number;
      origin?: string;
      destination?: string;
      provider?: "GOOGLE_ROUTES";
    };

type CachedQuote = {
  quote: ShippingQuote;
  expiresAt: number;
};

type ShippingQuoteServiceOptions = {
  environment: ShippingEnvironment;
  fetchImpl?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  successCacheMs?: number;
  failureCacheMs?: number;
  maxCacheEntries?: number;
  maxPendingQuotes?: number;
};

const SHIPPING_FALLBACK = "Podés elegir retiro sin costo o coordinar el envío por WhatsApp.";

function withShippingFallback(reason: string) {
  return `${reason} ${SHIPPING_FALLBACK}`;
}

function realValue(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized && !/^<.*>$/.test(normalized) ? normalized : "";
}

function numericValue(value: string | undefined) {
  const normalized = realValue(value);
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseShippingTariff(environment: ShippingEnvironment): ShippingTariff | null {
  const base = numericValue(environment.basePrice);
  const perKm = numericValue(environment.pricePerKm);
  const min = numericValue(environment.minPrice);
  const roundTo = numericValue(environment.roundTo);
  const maxKm = numericValue(environment.maxKm);

  if (
    base === null ||
    perKm === null ||
    min === null ||
    roundTo === null ||
    maxKm === null ||
    base < 0 ||
    perKm < 0 ||
    min < 0 ||
    roundTo <= 0 ||
    maxKm <= 0
  ) {
    return null;
  }

  return { base, perKm, min, roundTo, maxKm };
}

function cleanAddressPart(value: string | undefined, maxLength: number) {
  return value
    ?.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength) || undefined;
}

function addressLine(address: AddressPayload) {
  return [
    cleanAddressPart(address.street, 120),
    cleanAddressPart(address.number, 30),
    cleanAddressPart(address.apartment, 60),
    cleanAddressPart(address.city, 80) || "Rosario",
    cleanAddressPart(address.province, 80) || "Santa Fe",
    cleanAddressPart(address.postalCode, 30),
    "Argentina"
  ]
    .filter(Boolean)
    .join(", ");
}

function addressIsComplete(address: AddressPayload) {
  return Boolean(
    cleanAddressPart(address.street, 120) &&
    cleanAddressPart(address.number, 30) &&
    cleanAddressPart(address.city, 80) &&
    cleanAddressPart(address.province, 80)
  );
}

function durationLabel(value?: string) {
  const seconds = Number(value?.replace(/s$/, ""));
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function googleRoutesFailureReason(status: number, payload: GoogleRoutesError) {
  const reason = payload.error?.details?.find((detail) => detail.reason)?.reason;

  if (reason === "API_KEY_HTTP_REFERRER_BLOCKED") {
    return withShippingFallback("No pudimos calcular el envío automático porque el servicio de distancia necesita configuración.");
  }
  if (reason === "API_KEY_SERVICE_BLOCKED" || reason === "SERVICE_DISABLED") {
    return withShippingFallback("No pudimos calcular el envío automático porque Routes API no está disponible.");
  }
  if (status === 400 || status === 404) {
    return withShippingFallback("Google Maps no pudo procesar la dirección indicada.");
  }
  if (status === 401 || status === 403) {
    return withShippingFallback("No pudimos calcular el envío automático porque Google Maps rechazó la solicitud.");
  }
  if (status === 429) {
    return withShippingFallback("Google Maps alcanzó temporalmente el límite de consultas. Probá nuevamente.");
  }
  if (status >= 500) {
    return withShippingFallback("Google Maps no está disponible temporalmente.");
  }
  return withShippingFallback("No pudimos consultar la distancia real del envío.");
}

function unavailable(reason: string, origin?: string, destination?: string): ShippingQuote {
  return {
    available: false,
    amount: 0,
    reason: withShippingFallback(reason),
    origin,
    destination,
    provider: "GOOGLE_ROUTES"
  };
}

function calculateAmount(tariff: ShippingTariff, distanceMeters: number) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0 || distanceMeters > Number.MAX_SAFE_INTEGER) return null;
  const distanceKm = distanceMeters / 1_000;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (distanceKm > tariff.maxKm) return { outsideRange: true as const, distanceKm };

  const rawAmount = Math.max(tariff.min, tariff.base + distanceKm * tariff.perKm);
  const amount = Math.ceil(rawAmount / tariff.roundTo) * tariff.roundTo;
  if (!Number.isFinite(amount) || amount < 0 || amount > Number.MAX_SAFE_INTEGER) return null;
  return { outsideRange: false as const, distanceKm, amount };
}

export function createShippingQuoteService(options: ShippingQuoteServiceOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const timeoutMs = Math.max(100, options.timeoutMs ?? 7_000);
  const successCacheMs = Math.max(1_000, options.successCacheMs ?? 5 * 60_000);
  const failureCacheMs = Math.max(1_000, options.failureCacheMs ?? 30_000);
  const maxCacheEntries = Math.max(1, options.maxCacheEntries ?? 500);
  const maxPendingQuotes = Math.max(1, options.maxPendingQuotes ?? 64);
  const quoteCache = new Map<string, CachedQuote>();
  const pendingQuotes = new Map<string, Promise<ShippingQuote>>();

  const key = realValue(options.environment.googleMapsServerKey);
  const tariff = parseShippingTariff(options.environment);
  const origin = realValue(options.environment.storeAddress);

  function configStatus() {
    const googleMapsServerKeyConfigured = Boolean(key);
    const storeAddressConfigured = Boolean(origin);
    const shippingTariffConfigured = Boolean(tariff);
    return {
      googleMapsServerKeyConfigured,
      storeAddressConfigured,
      shippingTariffConfigured,
      shippingQuoteReady: googleMapsServerKeyConfigured && storeAddressConfigured && shippingTariffConfigured
    };
  }

  function cacheKey(address: AddressPayload) {
    return createHash("sha256")
      .update(JSON.stringify({ origin, destination: addressLine(address).toLowerCase(), tariff }))
      .digest("hex");
  }

  function trimCache(at: number) {
    for (const [cacheKeyValue, cached] of quoteCache) {
      if (cached.expiresAt <= at) quoteCache.delete(cacheKeyValue);
    }
    while (quoteCache.size > maxCacheEntries) {
      const oldest = quoteCache.keys().next().value as string | undefined;
      if (!oldest) break;
      quoteCache.delete(oldest);
    }
  }

  async function fetchQuote(address: AddressPayload): Promise<ShippingQuote> {
    const destination = addressLine(address);
    if (!addressIsComplete(address)) return unavailable("La dirección está incompleta.", origin, destination);
    if (!key) return unavailable("Falta configurar el servicio de distancia.", origin, destination);
    if (!origin) return unavailable("Falta configurar la dirección de origen de FZAC.", undefined, destination);
    if (!tariff) return unavailable("Falta configurar la tarifa vigente de FZAC.", origin, destination);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
        method: "POST",
        cache: "no-store",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": "status,condition,distanceMeters,duration"
        },
        body: JSON.stringify({
          origins: [{ waypoint: { address: origin } }],
          destinations: [{ waypoint: { address: destination } }],
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_UNAWARE",
          languageCode: "es-AR",
          units: "METRIC"
        })
      });
    } catch {
      return unavailable(
        controller.signal.aborted
          ? "El servicio de distancia no respondió a tiempo. Probá nuevamente."
          : "El servicio de distancia no respondió. Probá nuevamente.",
        origin,
        destination
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await response.json().catch(() => ({}))) as RouteMatrixElement[] | GoogleRoutesError;
    if (!response.ok) {
      return {
        available: false,
        amount: 0,
        reason: googleRoutesFailureReason(response.status, payload as GoogleRoutesError),
        origin,
        destination,
        provider: "GOOGLE_ROUTES"
      };
    }

    if (!Array.isArray(payload)) return unavailable("Google Maps devolvió una respuesta inválida.", origin, destination);
    const element = payload[0];
    const statusCode = Number(element?.status?.code ?? 0);
    const distanceMeters = Number(element?.distanceMeters ?? 0);
    if (element?.condition !== "ROUTE_EXISTS" || statusCode !== 0) {
      return unavailable("La dirección no pudo cotizarse con una ruta válida.", origin, destination);
    }

    const calculation = calculateAmount(tariff, distanceMeters);
    if (!calculation) return unavailable("La distancia recibida no es válida.", origin, destination);
    if (calculation.outsideRange) {
      return {
        available: false,
        amount: 0,
        reason: withShippingFallback(`La dirección supera el radio automático de ${tariff.maxKm} km desde Rosario.`),
        distanceKm: Number(calculation.distanceKm.toFixed(1)),
        origin,
        destination,
        provider: "GOOGLE_ROUTES"
      };
    }

    return {
      available: true,
      amount: calculation.amount,
      distanceKm: Number(calculation.distanceKm.toFixed(1)),
      durationText: durationLabel(element.duration),
      origin,
      destination,
      provider: "GOOGLE_ROUTES"
    };
  }

  async function quoteDeliveryForAddress(address: AddressPayload): Promise<ShippingQuote> {
    const at = now();
    trimCache(at);
    const lookupKey = cacheKey(address);
    const cached = quoteCache.get(lookupKey);
    if (cached && cached.expiresAt > at) return cached.quote;

    const pending = pendingQuotes.get(lookupKey);
    if (pending) return pending;
    if (pendingQuotes.size >= maxPendingQuotes) {
      return unavailable("Hay demasiadas cotizaciones en proceso. Probá nuevamente en un momento.");
    }

    const request = fetchQuote(address)
      .then((quote) => {
        const completedAt = now();
        quoteCache.set(lookupKey, {
          quote,
          expiresAt: completedAt + (quote.available ? successCacheMs : failureCacheMs)
        });
        trimCache(completedAt);
        return quote;
      })
      .finally(() => pendingQuotes.delete(lookupKey));

    pendingQuotes.set(lookupKey, request);
    return request;
  }

  return {
    canQuoteShipping: () => configStatus().shippingQuoteReady,
    getShippingConfigStatus: configStatus,
    quoteDeliveryForAddress
  };
}
