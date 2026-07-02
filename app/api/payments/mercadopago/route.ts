import { isMercadoPagoEnabled } from "@/lib/payments/mercadopago";

export async function GET() {
  return Response.json({
    provider: "MERCADOPAGO",
    enabled: isMercadoPagoEnabled(),
    message: isMercadoPagoEnabled()
      ? "Mercado Pago esta configurado para crear preferencias server-side."
      : "Mercado Pago no esta configurado. El checkout habilita simulacion controlada."
  });
}
