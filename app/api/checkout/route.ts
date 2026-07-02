import { ZodError } from "zod";
import { createCheckout } from "@/lib/db/orders";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "checkout"), 12, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos. Proba nuevamente en un minuto.", 429);

  try {
    const payload = await request.json();
    const result = await createCheckout(payload);
    return Response.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return jsonError(error.issues[0]?.message ?? "Datos de checkout invalidos.", 422);
    }
    return jsonError(error instanceof Error ? error.message : "No pudimos crear el checkout.", 400);
  }
}
