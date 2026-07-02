import { z } from "zod";
import { simulatePayment } from "@/lib/db/orders";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";

const schema = z.object({
  orderId: z.string().min(1),
  status: z.enum(["PAID", "PENDING", "FAILED"])
});

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "simulate-payment"), 20, 60_000);
  if (!limit.ok) return jsonError("Demasiados intentos de simulacion.", 429);

  try {
    const payload = schema.parse(await request.json());
    const result = await simulatePayment(payload.orderId, payload.status);
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No pudimos simular el pago.", 400);
  }
}
