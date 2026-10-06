import { getCurrentUser } from "@/lib/auth/get-user";
import { withApiTelemetry } from "@/lib/observability/request";
import { distributedRateLimitRequest, distributedRetryHeaders } from "@/lib/security/distributed-rate-limit";
import { jsonError } from "@/lib/utils/api";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

async function handlePost(request: Request) {
  const validation = validateJsonMutationRequest(request, 8 * 1024);
  if (!validation.ok) return jsonError(validation.message, validation.status);

  const currentUser = await getCurrentUser();
  if (!currentUser?.id) return jsonError("Necesitás iniciar sesión para comprar.", 401);

  const distributed = await distributedRateLimitRequest(request, {
    scope: "checkout-card-archived",
    limit: 6,
    windowMs: 60_000,
    identity: currentUser.id,
    identityLimit: 6,
    identityWindowMs: 10 * 60_000
  });
  if (!distributed.ok) {
    return jsonError(
      "Alcanzaste el límite de intentos. Esperá unos minutos.",
      429,
      distributedRetryHeaders(distributed)
    );
  }

  // This route cannot create a payment anymore. Existing Mercado Pago failures are
  // still closed atomically by the webhook/payment service through finalizeFailedPayment.
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
  return withApiTelemetry("checkout.card", request, () => handlePost(request));
}
