import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = new URL(process.env.BASE_URL || "http://127.0.0.1:3000");
const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (!localHosts.has(baseUrl.hostname) && process.env.QA_ALLOW_REMOTE_WRITES !== "true") {
  throw new Error("La prueba de persistencia del asistente solo acepta localhost salvo autorizacion explicita.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Falta configuracion server-side de Supabase para limpiar la prueba.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const visitorId = crypto.randomUUID();
let conversationId = null;
let feedbackTraceId = null;

async function ask(message) {
  const response = await fetch(new URL("/api/assistant", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, visitorId, conversationId, history: [] })
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  conversationId = body.conversationId;
  return body;
}

try {
  const first = await ask("Quiero calcular pintura");
  assert.equal(first.intent, "estimate");
  assert.ok(conversationId, "La conversacion debe persistirse en Supabase.");
  assert.match(first.message, /superficie/i);

  const second = await ask("La superficie es de 40 m2 y quiero dos manos");
  assert.equal(second.intent, "estimate");
  assert.match(second.message, /litros/i);

  const third = await ask("Ahora quiero pagar con transferencia");
  assert.equal(third.knowledge_id, "bank-transfer");
  assert.ok(third.sources.some((source) => source.href === "/medios-de-pago"));
  assert.match(third.trace_id, /^[0-9a-f-]{36}$/i);
  feedbackTraceId = third.trace_id;

  const forgedFeedbackResponse = await fetch(new URL("/api/assistant/feedback", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId,
      visitorId,
      traceId: crypto.randomUUID(),
      knowledgeId: third.knowledge_id,
      rating: "DOWN"
    })
  });
  assert.equal(forgedFeedbackResponse.status, 404, "Una traza ajena no debe contaminar la calidad del asistente.");

  const feedbackResponse = await fetch(new URL("/api/assistant/feedback", baseUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      conversationId,
      visitorId,
      traceId: feedbackTraceId,
      knowledgeId: third.knowledge_id,
      rating: "DOWN"
    })
  });
  assert.equal(feedbackResponse.status, 200, "Una conversación propia debe poder calificar la respuesta.");

  const { count, error } = await admin
    .from("chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId);
  if (error) throw error;
  assert.equal(count, 6, "Tres turnos deben generar seis mensajes.");

  const { data: latestAssistant, error: metadataError } = await admin
    .from("chat_messages")
    .select("metadata")
    .eq("conversation_id", conversationId)
    .eq("role", "ASSISTANT")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (metadataError) throw metadataError;
  assert.equal(latestAssistant?.metadata?.knowledge_sources?.[0]?.id, "bank-transfer");

  const { count: feedbackCount, error: feedbackError } = await admin
    .from("assistant_feedback")
    .select("id", { count: "exact", head: true })
    .eq("trace_id", feedbackTraceId);
  if (feedbackError) throw feedbackError;
  assert.equal(feedbackCount, 1, "La calificación debe quedar asociada a una única traza.");

  const { count: reviewCount, error: reviewError } = await admin
    .from("assistant_review_queue")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .eq("reason", "NEGATIVE_FEEDBACK");
  if (reviewError) throw reviewError;
  assert.equal(reviewCount, 1, "Un voto negativo valido debe crear una unica revision supervisada.");

  console.log(
    JSON.stringify({
      ok: true,
      baseUrl: baseUrl.origin,
      conversationPersisted: true,
      stateContinued: true,
      knowledgeTracePersisted: true,
      feedbackPersisted: feedbackCount === 1,
      forgedTraceRejected: forgedFeedbackResponse.status === 404,
      supervisedReviewCreated: reviewCount === 1,
      messagesPersisted: count
    })
  );
} finally {
  if (feedbackTraceId) await admin.from("assistant_feedback").delete().eq("trace_id", feedbackTraceId);
  if (conversationId) {
    await admin.from("chat_messages").delete().eq("conversation_id", conversationId);
    await admin.from("chat_conversations").delete().eq("id", conversationId);
  }
}
