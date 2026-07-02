import { createNaranjaXPaymentIntent, isNaranjaXEnabled } from "@/lib/payments/naranjax";
import { jsonError } from "@/lib/utils/api";

export async function GET() {
  return Response.json({
    provider: "NARANJAX",
    enabled: isNaranjaXEnabled(),
    message: isNaranjaXEnabled() ? "Naranja X listo para integrar con credenciales oficiales." : "Naranja X estara disponible proximamente."
  });
}

export async function POST() {
  try {
    const result = await createNaranjaXPaymentIntent();
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No pudimos iniciar Naranja X.", 400);
  }
}
