import { getApiAdmin } from "@/lib/auth/api-guards";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { assistantKnowledgeSchema } from "@/lib/validations/assistant-knowledge";

async function guard(request: Request) {
  const limit = rateLimit(getRequestKey(request, "admin-assistant-knowledge"), 80, 60_000);
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

  const [knowledgeResult, feedbackResult] = await Promise.all([
    access.admin.from("assistant_knowledge").select("*").order("updated_at", { ascending: false }).limit(200),
    access.admin.from("assistant_feedback").select("rating,knowledge_slug").limit(5000)
  ]);
  if (knowledgeResult.error) return jsonError("No pudimos cargar la base de conocimiento.", 400);

  const feedback = feedbackResult.data ?? [];
  return Response.json({
    entries: knowledgeResult.data ?? [],
    metrics: {
      total: knowledgeResult.data?.length ?? 0,
      active: knowledgeResult.data?.filter((entry) => entry.active).length ?? 0,
      positive: feedback.filter((item) => item.rating === "UP").length,
      negative: feedback.filter((item) => item.rating === "DOWN").length
    }
  });
}

export async function POST(request: Request) {
  const mutation = validateJsonMutationRequest(request, 16 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await guard(request);
  if ("error" in access) return access.error;
  const parsed = assistantKnowledgeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Datos inválidos.", 422);

  const payload = { ...parsed.data };
  delete payload.id;
  const { data, error } = await access.admin
    .from("assistant_knowledge")
    .insert({ ...payload, created_by: access.profile.id, updated_by: access.profile.id, published_at: payload.active ? new Date().toISOString() : null })
    .select("*")
    .single();
  if (error) return jsonError("No pudimos crear la respuesta. Revisá que el identificador no esté repetido.", 400);

  await access.admin.from("admin_audit_logs").insert({
    actor_id: access.profile.id,
    actor_email: access.profile.email,
    action: "ASSISTANT_KNOWLEDGE_CREATED",
    entity: "assistant_knowledge",
    entity_id: data.id,
    message: `Respuesta creada: ${data.title}`
  });
  return Response.json({ entry: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const mutation = validateJsonMutationRequest(request, 16 * 1024);
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);
  const access = await guard(request);
  if ("error" in access) return access.error;
  const parsed = assistantKnowledgeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !parsed.data.id) return jsonError(parsed.success ? "Falta el identificador." : parsed.error.issues[0]?.message ?? "Datos inválidos.", 422);

  const { id, ...payload } = parsed.data;
  const { data, error } = await access.admin
    .from("assistant_knowledge")
    .update({ ...payload, updated_by: access.profile.id, published_at: payload.active ? new Date().toISOString() : null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) return jsonError("No pudimos actualizar la respuesta.", 400);

  await access.admin.from("admin_audit_logs").insert({
    actor_id: access.profile.id,
    actor_email: access.profile.email,
    action: "ASSISTANT_KNOWLEDGE_UPDATED",
    entity: "assistant_knowledge",
    entity_id: data.id,
    message: `Respuesta actualizada: ${data.title}`
  });
  return Response.json({ entry: data });
}

export async function DELETE(request: Request) {
  const access = await guard(request);
  if ("error" in access) return access.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Identificador inválido.", 422);

  const { data, error } = await access.admin
    .from("assistant_knowledge")
    .update({ active: false, updated_by: access.profile.id, published_at: null })
    .eq("id", id)
    .select("id,title")
    .single();
  if (error) return jsonError("No pudimos desactivar la respuesta.", 400);

  await access.admin.from("admin_audit_logs").insert({
    actor_id: access.profile.id,
    actor_email: access.profile.email,
    action: "ASSISTANT_KNOWLEDGE_DISABLED",
    entity: "assistant_knowledge",
    entity_id: data.id,
    message: `Respuesta desactivada: ${data.title}`
  });
  return Response.json({ ok: true });
}
