import "server-only";

export function isNaranjaXEnabled() {
  // No adapter, signature verification or webhook contract has been implemented.
  // Environment variables alone must never expose a non-functional payment method.
  return false;
}

export async function createNaranjaXPaymentIntent() {
  return {
    enabled: false,
    code: "NARANJAX_NOT_IMPLEMENTED",
    message: "Naranja X no esta habilitado: falta una integracion oficial completa."
  };
}
