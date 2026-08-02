import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

const schema = z.object({
  traceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  visitorId: z.string().uuid().optional(),
  knowledgeId: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  rating: z.enum(["UP", "DOWN"])
});

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "assistant-feedback"), 20, 60_000);
  if (!limit.ok) return jsonError("Demasiadas valoraciones.", 429, retryAfterHeaders(limit));
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("No pudimos validar la valoración.", 422);

  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("La valoración no está disponible en este momento.", 503);
  const { data: conversation } = await admin
    .from("chat_conversations")
    .select("id,user_id,visitor_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conversation) return jsonError("La conversación no está disponible.", 404);

  const ownsConversation = user?.id
    ? conversation.user_id === user.id
    : !conversation.user_id && Boolean(parsed.data.visitorId) && conversation.visitor_id === parsed.data.visitorId;
  if (!ownsConversation) return jsonError("No autorizado.", 403);

  const { error } = await admin.from("assistant_feedback").upsert(
    {
      trace_id: parsed.data.traceId,
      conversation_id: conversation.id,
      user_id: user?.id ?? null,
      visitor_id: user?.id ? null : parsed.data.visitorId ?? null,
      knowledge_slug: parsed.data.knowledgeId,
      rating: parsed.data.rating
    },
    { onConflict: "trace_id" }
  );
  if (error) return jsonError("No pudimos guardar la valoración.", 400);
  return Response.json({ ok: true });
}
