import { z } from "zod";
import { calculateDistanceToRosario } from "@/lib/maps/distance";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";

const schema = z.object({ address: z.string().trim().min(6) });

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "maps-distance"), 20, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas de distancia.", 429);

  try {
    const payload = schema.parse(await request.json());
    const result = await calculateDistanceToRosario(payload.address);
    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "No pudimos calcular la distancia.", 400);
  }
}
