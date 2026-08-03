import "server-only";

import type { AssistantIntent } from "@/lib/assistant/contracts";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AssistantReviewReason = "NEGATIVE_FEEDBACK" | "LOW_CONFIDENCE" | "UNRESOLVED" | "HANDOFF";

const reasonPriority: Record<AssistantReviewReason, number> = {
  HANDOFF: 4,
  NEGATIVE_FEEDBACK: 3,
  UNRESOLVED: 3,
  LOW_CONFIDENCE: 1
};

export async function enqueueAssistantReview(input: {
  conversationId: string;
  userMessageId?: string | null;
  assistantMessageId: string;
  knowledgeSlug?: string | null;
  intent: AssistantIntent;
  reason: AssistantReviewReason;
  confidence?: number | null;
}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;
  const confidence = typeof input.confidence === "number" && Number.isFinite(input.confidence)
    ? Math.max(0, Math.min(1, input.confidence))
    : null;
  const { error } = await admin.from("assistant_review_queue").upsert({
    conversation_id: input.conversationId,
    user_message_id: input.userMessageId ?? null,
    assistant_message_id: input.assistantMessageId,
    knowledge_slug: input.knowledgeSlug ?? null,
    intent: input.intent,
    reason: input.reason,
    confidence,
    priority: reasonPriority[input.reason],
    status: "OPEN",
    last_seen_at: new Date().toISOString()
  }, { onConflict: "assistant_message_id,reason", ignoreDuplicates: true });
  return !error;
}
