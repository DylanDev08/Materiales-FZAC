import "server-only";

import { getEnv, hasRealValue } from "@/lib/utils/env";
import type { AddressPayload } from "@/types/domain";

type DistanceMatrixResponse = {
  status?: string;
  rows?: Array<{
    elements?: Array<{
      status?: string;
      distance?: { value?: number; text?: string };
      duration?: { text?: string };
    }>;
  }>;
};

export type ShippingQuote =
  | {
      available: true;
      amount: number;
      distanceKm: number;
      durationText: string;
      origin: string;
      destination: string;
      provider: "GOOGLE_DISTANCE_MATRIX";
    }
  | {
      available: false;
      amount: 0;
      reason: string;
      distanceKm?: number;
      origin?: string;
      destination?: string;
      provider?: "GOOGLE_DISTANCE_MATRIX";
    };

function addressLine(address: AddressPayload) {
  return [
    address.street,
    address.number,
    address.apartment,
    address.city || "Rosario",
    address.province || "Santa Fe",
    address.postalCode,
    "Argentina"
  ]
    .filter(Boolean)
    .join(", ");
}

function numberEnv(name: string) {
  const value = Number(getEnv(name));
  return Number.isFinite(value) ? value : null;
}

function shippingApiKey() {
  return getEnv("GOOGLE_MAPS_SERVER_KEY") || getEnv("GOOGLE_MAPS_API_KEY") || getEnv("GOOGLE_DISTANCE_MATRIX_KEY");
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

export function canQuoteShipping() {
  return hasRealValue(shippingApiKey()) && Boolean(shippingTariff());
}

export async function quoteDeliveryForAddress(address: AddressPayload): Promise<ShippingQuote> {
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
      reason: "Falta configurar la tarifa vigente de envio FZAC.",
      origin,
      destination
    };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("language", "es-AR");
  url.searchParams.set("region", "ar");
  url.searchParams.set("key", key);

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    return {
      available: false,
      amount: 0,
      reason: "No pudimos consultar distancia real del envio.",
      origin,
      destination,
      provider: "GOOGLE_DISTANCE_MATRIX"
    };
  }

  const data = (await response.json()) as DistanceMatrixResponse;
  const element = data.rows?.[0]?.elements?.[0];
  const distanceMeters = Number(element?.distance?.value ?? 0);
  const distanceKm = distanceMeters / 1000;

  if (data.status !== "OK" || element?.status !== "OK" || !distanceMeters) {
    return {
      available: false,
      amount: 0,
      reason: "La direccion no pudo cotizarse con distancia real.",
      origin,
      destination,
      provider: "GOOGLE_DISTANCE_MATRIX"
    };
  }

  if (distanceKm > tariff.maxKm) {
    return {
      available: false,
      amount: 0,
      reason: `La direccion supera el radio automatico de ${tariff.maxKm} km desde Rosario.`,
      distanceKm,
      origin,
      destination,
      provider: "GOOGLE_DISTANCE_MATRIX"
    };
  }

  const rawAmount = Math.max(tariff.min, tariff.base + distanceKm * tariff.perKm);

  return {
    available: true,
    amount: roundShipping(rawAmount, tariff.roundTo),
    distanceKm: Number(distanceKm.toFixed(1)),
    durationText: element.duration?.text ?? "",
    origin,
    destination,
    provider: "GOOGLE_DISTANCE_MATRIX"
  };
}
