import { z } from "zod";
import { getProductSuggestions } from "@/lib/db/catalog";
import { hasSqlMeta, sanitizeSearchTerm } from "@/lib/validations/security";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

const schema = z.object({
  q: z.string().optional()
});

export async function GET(request: Request) {
  const limit = rateLimit(getRequestKey(request, "search-suggestions"), 90, 60_000);
  if (!limit.ok) return jsonError("Demasiadas búsquedas. Probá nuevamente en un minuto.", 429, retryAfterHeaders(limit));

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) return jsonError("Busqueda invalida.", 422);

  const query = sanitizeSearchTerm(parsed.data.q);
  if (hasSqlMeta(parsed.data.q)) return jsonError("La busqueda contiene caracteres no permitidos.", 422);
  if (query.length < 2) return Response.json({ suggestions: [] });

  const suggestions = await getProductSuggestions(query);
  return Response.json({ suggestions });
}
