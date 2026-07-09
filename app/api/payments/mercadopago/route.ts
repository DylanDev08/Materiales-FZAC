import { isMercadoPagoConfigured, isPaymentsEnabled, isTestPaymentEnv } from "@/lib/payments/config";

export async function GET() {
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
