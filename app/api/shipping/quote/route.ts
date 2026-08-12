import { ZodError, z } from "zod";
import { quoteDeliveryForAddress } from "@/lib/shipping/quote";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { hasSqlMeta } from "@/lib/validations/security";

const addressSchema = z
  .object({
    street: z.string().trim().min(2).max(120),
    number: z.string().trim().min(1).max(30),
    apartment: z.string().trim().max(60).optional(),
    city: z.string().trim().min(2).max(80),
    province: z.string().trim().min(2).max(80),
    postalCode: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(240).optional()
  })
  .refine((value) => !Object.values(value).some((item) => hasSqlMeta(item)), "La dirección contiene caracteres no permitidos.");

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "shipping-quote"), 24, 60_000);
  const mutation = validateJsonMutationRequest(request, 8 * 1024);
  if (!limit.ok) return jsonError("Demasiadas cotizaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  try {
    const payload = addressSchema.parse(await request.json());
    const quote = await quoteDeliveryForAddress(payload);
    return Response.json(quote, { status: quote.available ? 200 : 422 });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Dirección inválida.", 422);
    return jsonError("No pudimos cotizar el envio.", 400);
  }
}
