import "server-only";

import { createHash } from "node:crypto";
import { getEnv, hasRealValue } from "@/lib/utils/env";
import type { AddressPayload } from "@/types/domain";

type RouteMatrixElement = {
  status?: { code?: number; message?: string };
  condition?: "ROUTE_EXISTS" | "ROUTE_NOT_FOUND";
  distanceMeters?: number;
  duration?: string;
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

function cleanAddressPart(value: string | undefined, maxLength = 90) {
  return value?.trim().replace(/\s+/g, " ").slice(0, maxLength) || undefined;
}

type CachedQuote = {
  quote: ShippingQuote;
  expiresAt: number;
};

const quoteCache = new Map<string, CachedQuote>();
const pendingQuotes = new Map<string, Promise<ShippingQuote>>();
const MAX_QUOTE_CACHE_ENTRIES = 500;
const SUCCESS_CACHE_MS = 5 * 60_000;
const FAILURE_CACHE_MS = 30_000;

function addressLine(address: AddressPayload) {
  return [
    cleanAddressPart(address.street, 120),
    cleanAddressPart(address.number, 20),
    cleanAddressPart(address.apartment, 50),
    cleanAddressPart(address.city, 80) || "Rosario",
    cleanAddressPart(address.province, 80) || "Santa Fe",
    cleanAddressPart(address.postalCode, 20),
    "Argentina"
  ]
    .filter(Boolean)
    .join(", ");
}

function numberEnv(name: string) {
  const raw = getEnv(name);
  if (!hasRealValue(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function shippingApiKey() {
  return getEnv("GOOGLE_MAPS_SERVER_KEY")
    || getEnv("GOOGLE_MAPS_SERVER_API_KEY")
    || getEnv("GOOGLE_MAPS_API_KEY")
    || getEnv("GOOGLE_DISTANCE_MATRIX_KEY");
}

function shippingTariff() {
  const base = numberEnv("FZAC_SHIPPING_BASE_PRICE");
  const perKm = numberEnv("FZAC_SHIPPING_PRICE_PER_KM");
  const min = numberEnv("FZAC_SHIPPING_MIN_PRICE") ?? 0;
  const roundTo = Math.max(numberEnv("FZAC_SHIPPING_ROUND_TO") ?? 10, 1);
  const maxKm = Math.max(numberEnv("FZAC_SHIPPING_MAX_KM") ?? 30, 1);

  if (base === null || perKm === null) return null;
  return { base, perKm, min, roundTo, maxKm };
}

function roundShipping(value: number, roundTo: number) {
  return Math.ceil(value / roundTo) * roundTo;
}

function durationLabel(value?: string) {
  const seconds = Number(value?.replace(/s$/, ""));
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  return `${Math.max(1, Math.round(seconds / 60))} min`;
}

export function canQuoteShipping() {
  return hasRealValue(shippingApiKey()) && Boolean(shippingTariff());
}

function quoteCacheKey(address: AddressPayload) {
  const tariff = shippingTariff();
  const origin = getEnv("FZAC_STORE_ADDRESS") || "Hermana Paula 3164, Rosario, Santa Fe, Argentina";
  return createHash("sha256")
    .update(JSON.stringify({ origin, destination: addressLine(address).toLowerCase(), tariff }))
    .digest("hex");
}

function trimQuoteCache(now: number) {
  for (const [key, cached] of quoteCache) {
    if (cached.expiresAt <= now) quoteCache.delete(key);
  }
  if (quoteCache.size <= MAX_QUOTE_CACHE_ENTRIES) return;
  const overflow = quoteCache.size - MAX_QUOTE_CACHE_ENTRIES;
  [...quoteCache.keys()].slice(0, overflow).forEach((key) => quoteCache.delete(key));
}

async function fetchDeliveryQuote(address: AddressPayload): Promise<ShippingQuote> {
  const key = shippingApiKey();
  const tariff = shippingTariff();
  const origin = getEnv("FZAC_STORE_ADDRESS") || "Hermana Paula 3164, Rosario, Santa Fe, Argentina";
  const destination = addressLine(address);

  if (!hasRealValue(key)) {
    return {
      available: false,
      amount: 0,
      reason: "Falta configurar la API server-side de Google Maps para calcular distancia real.",
      origin,
      destination
    };
  }

  if (!tariff) {
    return {
      available: false,
      amount: 0,
      reason: "Falta configurar la tarifa vigente de envío FZAC.",
      origin,
      destination
    };
  }

  let response: Response;
  try {
    response = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      cache: "no-store",
      signal: AbortSignal.timeout(7_000),
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "originIndex,destinationIndex,status,condition,distanceMeters,duration"
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
    return {
      available: false,
      amount: 0,
      reason: "El servicio de distancia no respondió a tiempo. Probá nuevamente.",
      origin,
      destination,
      provider: "GOOGLE_ROUTES"
    };
  }
  if (!response.ok) {
    return {
      available: false,
      amount: 0,
      reason: "No pudimos consultar distancia real del envío.",
      origin,
      destination,
      provider: "GOOGLE_ROUTES"
    };
  }

  const data = (await response.json()) as RouteMatrixElement[];
  const element = data[0];
  const distanceMeters = Number(element?.distanceMeters ?? 0);
  const distanceKm = distanceMeters / 1000;

  if (element?.condition !== "ROUTE_EXISTS" || Number(element?.status?.code ?? 0) !== 0 || !distanceMeters) {
    return {
      available: false,
      amount: 0,
      reason: "La dirección no pudo cotizarse con distancia real.",
      origin,
      destination,
      provider: "GOOGLE_ROUTES"
    };
  }

  if (distanceKm > tariff.maxKm) {
    return {
      available: false,
      amount: 0,
      reason: `La dirección supera el radio automático de ${tariff.maxKm} km desde Rosario.`,
      distanceKm,
      origin,
      destination,
      provider: "GOOGLE_ROUTES"
    };
  }

  const rawAmount = Math.max(tariff.min, tariff.base + distanceKm * tariff.perKm);

  return {
    available: true,
    amount: roundShipping(rawAmount, tariff.roundTo),
    distanceKm: Number(distanceKm.toFixed(1)),
    durationText: durationLabel(element.duration),
    origin,
    destination,
    provider: "GOOGLE_ROUTES"
  };
}

export async function quoteDeliveryForAddress(address: AddressPayload): Promise<ShippingQuote> {
  const now = Date.now();
  const key = quoteCacheKey(address);
  const cached = quoteCache.get(key);
  if (cached && cached.expiresAt > now) return cached.quote;

  const pending = pendingQuotes.get(key);
  if (pending) return pending;

  const request = fetchDeliveryQuote(address)
    .then((quote) => {
      trimQuoteCache(Date.now());
      quoteCache.set(key, {
        quote,
        expiresAt: Date.now() + (quote.available ? SUCCESS_CACHE_MS : FAILURE_CACHE_MS)
      });
      return quote;
    })
    .finally(() => pendingQuotes.delete(key));

  pendingQuotes.set(key, request);
  return request;
}
