import { getPaymentConfig, getPaymentProductionReadiness, isMercadoPagoConfigured, isPaymentsEnabled, isTestPaymentEnv } from "@/lib/payments/config";
import { jsonError } from "@/lib/utils/api";
import { getEnv, hasRealValue } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "payment-provider-status"), 60, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Esperá un momento.", 429, retryAfterHeaders(limit));
  const enabled = isMercadoPagoConfigured();
  const cardEnabled = isMercadoPagoConfigured("card");

  if (!enabled) {
    const configuredBackend = getEnv("API_PROXY_ORIGIN");
    const backend = hasRealValue(configuredBackend) ? configuredBackend : "https://materiales-fzac.onrender.com";
    if (hasRealValue(backend)) {
      try {
        const target = new URL("/api/payments/mercadopago", backend);
        const response = await fetch(target, { cache: "no-store" });
        if (response.ok) {
          const body = await response.text();
          return new Response(body, {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store"
            }
          });
        }
      } catch {
        // Si el backend privado falla, continuamos con el estado local.
      }
    }
  }
  const config = getPaymentConfig();
  const productionReadiness = getPaymentProductionReadiness();
  return Response.json({
    provider: "MERCADOPAGO",
    enabled,
    cardEnabled,
    cardPublicKey: cardEnabled ? config.cardPublicKey : "",
    paymentsEnabled: isPaymentsEnabled(),
    environment: isTestPaymentEnv() ? "test" : "production",
    productionReadiness,
    message: enabled
      ? "Mercado Pago está activo para cobrar ventas."
      : "Mercado Pago no está disponible para cobrar en este momento."
  }, { headers: { "Cache-Control": "no-store" } });
}
