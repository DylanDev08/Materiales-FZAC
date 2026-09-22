import { handleMercadoPagoWebhook } from "@/lib/payments/mercadopago-webhook";
import { withApiTelemetry } from "@/lib/observability/request";

async function handlePost(request: Request) {
  const result = await handleMercadoPagoWebhook(request);
  return Response.json(result.body, { status: result.status });
}


export async function POST(request: Request) { {
  return withApiTelemetry("payments.webhook", request, () => handlePost(request));
}
