import "server-only";

import { getEnv, hasRealValue } from "@/lib/utils/env";

const ORIGIN = "Rosario, Santa Fe, Argentina";

export type DistanceResult = {
  distanceKm: number;
  durationText?: string;
  deliveryAvailable: boolean;
  zoneSnapshot: string;
};

export async function calculateDistanceToRosario(address: string): Promise<DistanceResult> {
  const key = getEnv("GOOGLE_MAPS_SERVER_API_KEY");
  if (!hasRealValue(key)) {
    throw new Error("Google Maps server key no esta configurada.");
  }

  const params = new URLSearchParams({
    origins: ORIGIN,
    destinations: address,
    units: "metric",
    language: "es-AR",
    key
  });

  const response = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) throw new Error("No pudimos consultar Google Maps.");

  const payload = (await response.json()) as {
    rows?: Array<{ elements?: Array<{ status: string; distance?: { value: number }; duration?: { text: string } }> }>;
    status?: string;
  };

  const element = payload.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK" || !element.distance) {
    throw new Error("No pudimos calcular la distancia para esa direccion.");
  }

  const distanceKm = Number((element.distance.value / 1000).toFixed(1));

  return {
    distanceKm,
    durationText: element.duration?.text,
    deliveryAvailable: distanceKm <= 30,
    zoneSnapshot: distanceKm <= 30 ? "Envio disponible dentro de 30 km" : "Fuera de zona de envio FZAC"
  };
}
