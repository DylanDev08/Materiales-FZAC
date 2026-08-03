import { z } from "zod";
import { ASSISTANT_INTENTS, type AssistantIntent } from "@/lib/assistant/contracts";
import { enqueueAssistantReview } from "@/lib/assistant/quality";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";

const schema = z.object({
  traceId: z.string().uuid(),
  conversationId: z.string().uuid(),
  visitorId: z.string().uuid().optional(),
  knowledgeId: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  rating: z.enum(["UP", "DOWN"])
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function intentFromMetadata(metadata: unknown): AssistantIntent {
  if (!isRecord(metadata) || !isRecord(metadata.assistant_state)) return "fallback";
  const topic = metadata.assistant_state.topic;
  return typeof topic === "string" && ASSISTANT_INTENTS.includes(topic as AssistantIntent)
    ? topic as AssistantIntent
    : "fallback";
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 4 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const limit = rateLimit(getRequestKey(request, "assistant-feedback"), 20, 60_000);
  if (!limit.ok) return jsonError("Demasiadas valoraciones.", 429, retryAfterHeaders(limit));
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("No pudimos validar la valoracion.", 422);

  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!admin) return jsonError("La valoracion no esta disponible en este momento.", 503);
  const { data: conversation } = await admin
    .from("chat_conversations")
    .select("id,user_id,visitor_id")
    .eq("id", parsed.data.conversationId)
    .maybeSingle();
  if (!conversation) return jsonError("La conversacion no esta disponible.", 404);

  const ownsConversation = user?.id
    ? conversation.user_id === user.id
    : !conversation.user_id && Boolean(parsed.data.visitorId) && conversation.visitor_id === parsed.data.visitorId;
  if (!ownsConversation) return jsonError("No autorizado.", 403);

  const { data: assistantMessage } = await admin
    .from("chat_messages")
    .select("id,metadata,created_at")
    .eq("conversation_id", conversation.id)
    .eq("role", "ASSISTANT")
    .contains("metadata", { trace_id: parsed.data.traceId })
    .maybeSingle();
  if (!assistantMessage) {
    return jsonError("La respuesta calificada no pertenece a esta conversacion.", 404);
  }

  const metadata = isRecord(assistantMessage.metadata) ? assistantMessage.metadata : {};
  const firstKnowledgeSource = Array.isArray(metadata.knowledge_sources) && isRecord(metadata.knowledge_sources[0])
    ? metadata.knowledge_sources[0]
    : null;
  const storedKnowledgeId = typeof metadata.knowledge_id === "string"
    ? metadata.knowledge_id
    : typeof firstKnowledgeSource?.id === "string" ? firstKnowledgeSource.id : null;
  if (!storedKnowledgeId) {
    return jsonError("La respuesta no admite una valoracion de conocimiento.", 422);
  }
  if (storedKnowledgeId !== parsed.data.knowledgeId) {
    return jsonError("La respuesta no coincide con el contenido calificado.", 422);
  }
  const knowledgeSlug = storedKnowledgeId;
  const confidence = typeof metadata.confidence === "number" ? metadata.confidence : null;
  const { data: userMessage } = await admin
    .from("chat_messages")
    .select("id")
    .eq("conversation_id", conversation.id)
    .eq("role", "USER")
    .lte("created_at", assistantMessage.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await admin.from("assistant_feedback").upsert(
    {
      trace_id: parsed.data.traceId,
      conversation_id: conversation.id,
      user_id: user?.id ?? null,
      visitor_id: user?.id ? null : parsed.data.visitorId ?? null,
      knowledge_slug: knowledgeSlug,
      rating: parsed.data.rating
    },
    { onConflict: "trace_id" }
  );
  if (error) return jsonError("No pudimos guardar la valoracion.", 400);

  if (parsed.data.rating === "DOWN") {
    await enqueueAssistantReview({
      conversationId: conversation.id,
      userMessageId: userMessage?.id ?? null,
      assistantMessageId: assistantMessage.id,
      knowledgeSlug,
      intent: intentFromMetadata(metadata),
      reason: "NEGATIVE_FEEDBACK",
      confidence
    });
  }

  return Response.json({ ok: true });
}
