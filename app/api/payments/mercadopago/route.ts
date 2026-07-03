import { isMercadoPagoConfigured, isPaymentsEnabled } from "@/lib/payments/config";

export async function GET() {
  const enabled = isMercadoPagoConfigured();
  return Response.json({
    provider: "MERCADOPAGO",
    enabled,
    paymentsEnabled: isPaymentsEnabled(),
    message: enabled
      ? "Mercado Pago esta configurado para crear preferencias server-side."
      : "El flujo comercial ya esta preparado. Solo falta configurar pagos para operar en produccion."
  });
}
