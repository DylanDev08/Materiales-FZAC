import { getPaymentProductionReadiness, isTestPaymentEnv } from "@/lib/payments/config";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "payment-provider-status"), 60, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Esperá un momento.", 429, retryAfterHeaders(limit));

  // No habilitar el proveedor por variables antiguas ni consultar un backend de pago heredado.
  // Los webhooks de operaciones previas permanecen disponibles para conciliación.
  return Response.json({
    provider: "MERCADOPAGO",
    enabled: false,
    cardEnabled: false,
    cardPublicKey: "",
    paymentsEnabled: false,
    environment: isTestPaymentEnv() ? "test" : "production",
    productionReadiness: getPaymentProductionReadiness(),
    message: "Los pedidos nuevos de FZAC se coordinan únicamente por WhatsApp."
  }, { headers: { "Cache-Control": "no-store" } });
}
