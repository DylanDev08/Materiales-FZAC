import { withApiTelemetry } from "@/lib/observability/request";

async function handlePost() {
  return Response.json(
    {
      ok: false,
      error: "PAYMENT_FLOW_ARCHIVED",
      message: "Los pagos nuevos con tarjeta/Mercado Pago están archivados. Confirmá el pedido por WhatsApp y FZAC te enviará los datos para realizar la transferencia."
    },
    { status: 410 }
  );
}

export async function POST(request: Request) {
  return withApiTelemetry("checkout.card", request, () => handlePost());
}
