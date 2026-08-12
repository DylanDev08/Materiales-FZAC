import { z } from "zod";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { normalizeEmail } from "@/lib/validations/auth";

const schema = z.object({
  email: z.string().trim().email().transform(normalizeEmail)
});

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-email-exists"), 30, 60_000);
  const mutation = validateJsonMutationRequest(request, 2 * 1024);
  if (!limit.ok) return jsonError("Demasiadas consultas. Espera unos minutos.", 429, retryAfterHeaders(limit));
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Email invalido.", 422);

  return Response.json(
    { checked: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
