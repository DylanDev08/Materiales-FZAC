import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit } from "@/lib/utils/rate-limit";
import { normalizeEmail } from "@/lib/validations/auth";

const schema = z.object({
  email: z.string().trim().email().transform(normalizeEmail)
});

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "auth-email-exists"), 30, 60_000);
  if (!limit.ok) return jsonError("Demasiadas consultas. Espera unos minutos.", 429);

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return jsonError("Email invalido.", 422);

  const admin = getSupabaseAdminClient();
  if (!admin) return Response.json({ exists: false, checked: false });

  const { data } = await admin.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle();
  return Response.json({ exists: Boolean(data), checked: true });
}
