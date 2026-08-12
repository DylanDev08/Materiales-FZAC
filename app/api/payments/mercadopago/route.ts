import { isMercadoPagoConfigured, isPaymentsEnabled, isTestPaymentEnv } from "@/lib/payments/config";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "payment-provider-status"), 60, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Esperá un momento.", 429, retryAfterHeaders(limit));
  const enabled = isMercadoPagoConfigured();
  return Response.json({
    provider: "CONFIGURED_PAYMENT_PROVIDER",
    enabled,
    paymentsEnabled: isPaymentsEnabled(),
    environment: isTestPaymentEnv() ? "test" : "production",
    message: enabled
      ? "El proveedor de pago online esta configurado para operar server-side."
      : "El flujo comercial ya esta preparado. Solo falta configurar pagos para operar en produccion."
  });
}
