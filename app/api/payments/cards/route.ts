import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "payment-capabilities"), 60, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Esperá un momento.", 429, retryAfterHeaders(limit));
  return Response.json({
    provider: "CONFIGURED_PAYMENT_PROVIDER",
    directCardProcessing: false,
    tokenizedCardCheckout: true,
    message:
      "FZAC no procesa ni almacena tarjetas. El checkout usa tokenizacion del proveedor para debito/credito."
  });
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "payment-capabilities-post"), 12, 60_000);
  if (!limit.ok) return jsonError("Demasiadas solicitudes. Esperá un momento.", 429, retryAfterHeaders(limit));
  return Response.json(
    {
      ok: false,
      message:
        "Por seguridad y cumplimiento PCI, FZAC no recibe numeros de tarjeta ni CVV. Inicia el pago desde /checkout para usar el formulario tokenizado."
    },
    { status: 405 }
  );
}
