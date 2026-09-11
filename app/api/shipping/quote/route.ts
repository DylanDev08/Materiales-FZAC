import { ZodError, z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { quoteDeliveryForAddress } from "@/lib/shipping/quote";
import { jsonError } from "@/lib/utils/api";
import {
  acquireRequestConcurrency,
  getRequestKey,
  rateLimit,
  rateLimitIdentity,
  retryAfterHeaders
} from "@/lib/utils/rate-limit";
import { readLimitedJson } from "@/lib/utils/request-security";
import { hasSqlMeta } from "@/lib/validations/security";

const addressSchema = z
  .object({
    street: z.string().trim().min(2, "Ingresá una calle válida.").max(120, "La calle es demasiado larga.").refine((value) => {
      const letters = value.normalize("NFD").replace(/[^a-z]/gi, "").toLowerCase();
      return letters.length >= 3 && new Set(letters).size >= 2;
    }, "Ingresá una calle válida."),
    number: z.string().trim().min(1, "Ingresá una altura válida.").max(30, "La altura es demasiado larga.").refine(
      (value) => !/^\d+$/.test(value) || Number(value) <= 99_999,
      "Ingresá una altura válida."
    ),
    apartment: z.string().trim().max(60).optional(),
    city: z.string().trim().min(2, "Ingresá una ciudad válida.").max(80),
    province: z.string().trim().min(2, "Ingresá una provincia válida.").max(80),
    postalCode: z.string().trim().max(30).optional(),
    notes: z.string().trim().max(240).optional()
  })
  .refine((value) => !Object.values(value).some((item) => hasSqlMeta(item)), "La dirección contiene caracteres no permitidos.");

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "shipping-quote"), 12, 60_000);
  if (!limit.ok) return jsonError("Demasiadas cotizaciones. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));
  const body = await readLimitedJson(request, 8 * 1024);
  if (!body.ok) return jsonError(body.message, body.status);

  try {
    const payload = addressSchema.parse(body.data);
    const user = await getCurrentUser();
    if (user?.id) {
      const identityLimit = rateLimitIdentity("shipping-quote", user.id, 18, 10 * 60_000);
      if (!identityLimit.ok) {
        return jsonError(
          "Alcanzaste el límite de cotizaciones. Esperá unos minutos para volver a intentar.",
          429,
          retryAfterHeaders(identityLimit)
        );
      }
    }

    const slot = acquireRequestConcurrency(request, {
      scope: "shipping-quote",
      identity: user?.id,
      maxGlobal: 8,
      maxPerIp: 1,
      maxPerIdentity: 1,
      leaseMs: 12_000
    });
    if (!slot.ok) {
      return jsonError("Ya estamos procesando una cotización. Esperá un momento.", 429, retryAfterHeaders(slot));
    }

    try {
      const quote = await quoteDeliveryForAddress(payload);
      return Response.json(quote, { status: quote.available ? 200 : 422 });
    } finally {
      slot.release();
    }
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Dirección inválida.", 422);
    return jsonError("No pudimos cotizar el envio.", 400);
  }
}
