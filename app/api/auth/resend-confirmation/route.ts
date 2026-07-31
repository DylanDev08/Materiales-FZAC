import { ZodError, z } from "zod";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/utils/api";
import { getRequestSiteUrl } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { normalizeEmail } from "@/lib/validations/auth";

const schema = z.object({
  email: z.string().trim().email("Ingresá un email válido.").transform(normalizeEmail)
});

const genericMessage = "Si la cuenta está pendiente, vas a recibir un nuevo enlace de Fortaleza Construcciones.";

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 2 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const limit = rateLimit(getRequestKey(request, "auth-resend-confirmation"), 3, 15 * 60_000);
  if (!limit.ok) return jsonError("Esperá unos minutos antes de solicitar otro enlace.", 429, retryAfterHeaders(limit));

  try {
    const payload = schema.parse(await request.json());
    const emailLimit = rateLimit(`auth-resend-confirmation-email:${payload.email}`, 2, 30 * 60_000);
    if (!emailLimit.ok) return Response.json({ ok: true, message: genericMessage });

    const supabase = await getSupabaseServerClient();
    if (supabase) {
      const siteUrl = getRequestSiteUrl(request);
      await supabase.auth.resend({
        type: "signup",
        email: payload.email,
        options: { emailRedirectTo: `${siteUrl}/auth/callback?next=/cuenta` }
      });
    }

    return Response.json({ ok: true, message: genericMessage });
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Email inválido.", 422);
    if (error instanceof SyntaxError) return jsonError("El contenido enviado no es válido.", 400);
    return Response.json({ ok: true, message: genericMessage });
  }
}
