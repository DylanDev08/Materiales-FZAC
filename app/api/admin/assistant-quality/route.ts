import { z } from "zod";
import { buildAssistantQualityAnalytics } from "@/lib/assistant/quality-analytics";
import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { isSafePlainText } from "@/lib/validations/security";

const updateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"]),
  notes: z.string().trim().max(800).refine(isSafePlainText, "Las notas contienen contenido no permitido.").optional()
});

async function guard(request: Request) {
  const limit = rateLimit(getRequestKey(request, "admin-assistant-quality"), 60, 60_000);
  if (!limit.ok) return { error: jsonError("Demasiadas solicitudes.", 429, retryAfterHeaders(limit)) };
  const profile = await getApiAdmin();
  if (!profile) return { error: jsonError("No autorizado.", 401) };
  const admin = getSupabaseAdminClient();
  if (!admin) return { error: jsonError("Backend administrativo no disponible.", 503) };
  return { profile, admin };
}

export async function GET(request: Request) {
  const access = await guard(request);
  if ("error" in access) return access.error;
  const range = z.enum(["7", "30", "90"]).catch("30").parse(new URL(request.url).searchParams.get("range"));
  const days = Number(range);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);
  since.setUTCHours(0, 0, 0, 0);

  const { data: queue, error } = await access.admin
    .from("assistant_review_queue")
    .select("id,conversation_id,user_message_id,assistant_message_id,knowledge_slug,intent,reason,confidence,priority,status,occurrence_count,review_notes,reviewed_at,first_seen_at,last_seen_at")
    .order("priority", { ascending: false })
    .order("last_seen_at", { ascending: false })
    .limit(250);
  if (error) return jsonError("No pudimos cargar la cola de calidad.", 500);

  const messageIds = Array.from(new Set((queue ?? []).flatMap((item) => [
    item.user_message_id,
    item.assistant_message_id
  ]).filter((id): id is string => Boolean(id))));
  const { data: messages } = messageIds.length
    ? await access.admin.from("chat_messages").select("id,content,created_at").in("id", messageIds)
    : { data: [] };
  const messagesById = new Map((messages ?? []).map((message) => [message.id, message]));
  const items = (queue ?? []).map((item) => ({
    id: item.id,
    knowledge_slug: item.knowledge_slug,
    intent: item.intent,
    reason: item.reason,
    confidence: item.confidence,
    priority: item.priority,
    status: item.status,
    occurrence_count: item.occurrence_count,
    review_notes: item.review_notes,
    reviewed_at: item.reviewed_at,
    first_seen_at: item.first_seen_at,
    last_seen_at: item.last_seen_at,
    user_message: item.user_message_id ? messagesById.get(item.user_message_id) ?? null : null,
    assistant_message: messagesById.get(item.assistant_message_id) ?? null
  }));

  const [{ data: assistantMessages, error: messagesError }, { data: feedback, error: feedbackError }] = await Promise.all([
    access.admin
      .from("chat_messages")
      .select("id,created_at,metadata")
      .eq("role", "ASSISTANT")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000),
    access.admin
      .from("assistant_feedback")
      .select("rating,created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000)
  ]);
  if (messagesError || feedbackError) return jsonError("No pudimos calcular las metricas del asistente.", 500);

  const analytics = buildAssistantQualityAnalytics({
    days,
    messages: assistantMessages ?? [],
    feedback: (feedback ?? []).flatMap((item) => item.rating === "UP" || item.rating === "DOWN"
      ? [{ rating: item.rating, created_at: item.created_at }]
      : []),
    reviews: (queue ?? []).map((item) => ({
      assistant_message_id: item.assistant_message_id,
      intent: item.intent,
      reason: item.reason,
      confidence: item.confidence,
      priority: item.priority,
      status: item.status,
      occurrence_count: item.occurrence_count,
      knowledge_slug: item.knowledge_slug,
      last_seen_at: item.last_seen_at,
      user_message: item.user_message_id ? messagesById.get(item.user_message_id) ?? null : null
    }))
  });

  const metrics = {
    pending: items.filter((item) => item.status === "OPEN").length,
    reviewing: items.filter((item) => item.status === "REVIEWING").length,
    resolved: items.filter((item) => item.status === "RESOLVED").length,
    negative: items.filter((item) => item.reason === "NEGATIVE_FEEDBACK" && item.status !== "DISMISSED").length,
    urgent: items.filter((item) => item.priority >= 3 && ["OPEN", "REVIEWING"].includes(item.status)).length
  };
  return Response.json({ items, metrics, analytics }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const mutation = validateJsonMutationRequest(request, 4 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await guard(request);
  if ("error" in access) return access.error;
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Datos invalidos.", 422);

  const now = new Date().toISOString();
  const { data, error } = await access.admin
    .from("assistant_review_queue")
    .update({
      status: parsed.data.status,
      review_notes: parsed.data.notes || null,
      reviewed_by: access.profile.id,
      reviewed_at: parsed.data.status === "OPEN" ? null : now
    })
    .eq("id", parsed.data.id)
    .select("id,status")
    .maybeSingle();
  if (error || !data) return jsonError("No pudimos actualizar la revision.", 400);

  await access.admin.from("admin_audit_logs").insert({
    actor_id: access.profile.id,
    actor_email: access.profile.email,
    action: "ASSISTANT_REVIEW_UPDATED",
    entity: "assistant_review_queue",
    entity_id: data.id,
    message: `Revision del asistente actualizada a ${data.status}`
  });
  return Response.json({ item: data });
}
