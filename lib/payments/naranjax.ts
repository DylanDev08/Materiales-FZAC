import "server-only";

import { getEnv, hasRealValue } from "@/lib/utils/env";

export function isNaranjaXEnabled() {
  return getEnv("NARANJAX_ENABLED") === "true" && hasRealValue(getEnv("NARANJAX_API_BASE_URL"));
}

export async function createNaranjaXPaymentIntent() {
  if (!isNaranjaXEnabled()) {
    return {
      enabled: false,
      message: "Naranja X estara disponible proximamente."
    };
  }

  throw new Error("La integracion Naranja X requiere documentacion oficial y credenciales productivas.");
}
