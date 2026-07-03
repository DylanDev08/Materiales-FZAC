import { handleMercadoPagoWebhook } from "@/lib/payments/mercadopago-webhook";

export async function POST(request: Request) {
  const result = await handleMercadoPagoWebhook(request);
  return Response.json(result.body, { status: result.status });
}
