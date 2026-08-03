import type { AssistantIntent } from "@/lib/assistant/contracts";

type AssistantMessage = { id: string; created_at: string; metadata: unknown };
type Feedback = { rating: "UP" | "DOWN"; created_at: string };
type Review = {
  assistant_message_id: string;
  intent: string;
  reason: string;
  confidence: number | string | null;
  priority: number;
  status: string;
  occurrence_count: number;
  knowledge_slug: string | null;
  last_seen_at: string;
  user_message?: { content?: string | null } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function messageIntent(metadata: unknown): string {
  if (!isRecord(metadata) || !isRecord(metadata.assistant_state)) return "fallback";
  return typeof metadata.assistant_state.topic === "string" ? metadata.assistant_state.topic : "fallback";
}

function messageConfidence(metadata: unknown) {
  if (!isRecord(metadata)) return null;
  const value = Number(metadata.confidence);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

function dayKey(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function percent(numerator: number, denominator: number) {
  return denominator > 0 ? Math.round((numerator / denominator) * 100) : null;
}

export function redactAssistantQuestion(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[referencia]")
    .replace(/\+?\d(?:[\s().-]*\d){7,}/g, "[telefono]")
    .replace(/\b(?:pedido|orden)\s*#?\s*[a-z0-9-]{5,}\b/gi, "pedido [referencia]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function buildAssistantQualityAnalytics(input: {
  days: number;
  now?: Date;
  messages: AssistantMessage[];
  feedback: Feedback[];
  reviews: Review[];
}) {
  const now = input.now ?? new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const trend = Array.from({ length: input.days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (input.days - index - 1));
    return { date: date.toISOString().slice(0, 10), responses: 0, helpful: 0, negative: 0, signals: 0 };
  });
  const trendByDay = new Map(trend.map((day) => [day.date, day]));
  const intents = new Map<string, { intent: string; responses: number; confidenceTotal: number; confidenceCount: number; signals: number }>();
  let confidenceTotal = 0;
  let confidenceCount = 0;

  for (const message of input.messages) {
    const day = dayKey(message.created_at);
    const bucket = day ? trendByDay.get(day) : null;
    if (bucket) bucket.responses += 1;
    const intent = messageIntent(message.metadata);
    const confidence = messageConfidence(message.metadata);
    const intentBucket = intents.get(intent) ?? { intent, responses: 0, confidenceTotal: 0, confidenceCount: 0, signals: 0 };
    intentBucket.responses += 1;
    if (confidence !== null) {
      intentBucket.confidenceTotal += confidence;
      intentBucket.confidenceCount += 1;
      confidenceTotal += confidence;
      confidenceCount += 1;
    }
    intents.set(intent, intentBucket);
  }

  let helpful = 0;
  let negative = 0;
  for (const feedback of input.feedback) {
    const day = dayKey(feedback.created_at);
    const bucket = day ? trendByDay.get(day) : null;
    if (feedback.rating === "UP") {
      helpful += 1;
      if (bucket) bucket.helpful += 1;
    } else {
      negative += 1;
      if (bucket) bucket.negative += 1;
    }
  }

  const activeReviews = input.reviews.filter((review) => review.status === "OPEN" || review.status === "REVIEWING");
  const consideredReviews = input.reviews.filter((review) => review.status !== "DISMISSED");
  const resolvedReviews = input.reviews.filter((review) => review.status === "RESOLVED");
  const handoffMessages = new Set(input.reviews.filter((review) => review.reason === "HANDOFF").map((review) => review.assistant_message_id));
  for (const review of input.reviews) {
    const day = dayKey(review.last_seen_at);
    const bucket = day ? trendByDay.get(day) : null;
    if (bucket) bucket.signals += review.occurrence_count;
    const intentBucket = intents.get(review.intent) ?? { intent: review.intent, responses: 0, confidenceTotal: 0, confidenceCount: 0, signals: 0 };
    intentBucket.signals += review.occurrence_count;
    intents.set(review.intent, intentBucket);
  }

  const opportunityMap = new Map<string, {
    intent: string;
    reason: string;
    knowledgeSlug: string | null;
    count: number;
    priority: number;
    lastSeen: string;
    example: string;
  }>();
  for (const review of activeReviews) {
    const key = `${review.intent}|${review.reason}|${review.knowledge_slug ?? "general"}`;
    const existing = opportunityMap.get(key);
    const example = redactAssistantQuestion(review.user_message?.content);
    opportunityMap.set(key, {
      intent: review.intent,
      reason: review.reason,
      knowledgeSlug: review.knowledge_slug,
      count: (existing?.count ?? 0) + review.occurrence_count,
      priority: Math.max(existing?.priority ?? 0, review.priority),
      lastSeen: existing && existing.lastSeen > review.last_seen_at ? existing.lastSeen : review.last_seen_at,
      example: existing?.example || example
    });
  }

  const questionMap = new Map<string, { question: string; count: number; priority: number; lastSeen: string }>();
  for (const review of activeReviews) {
    const question = redactAssistantQuestion(review.user_message?.content);
    if (!question) continue;
    const key = question.toLocaleLowerCase("es-AR").replace(/[^\p{L}\p{N}\s\[\]]/gu, "").replace(/\s+/g, " ");
    const existing = questionMap.get(key);
    questionMap.set(key, {
      question,
      count: (existing?.count ?? 0) + review.occurrence_count,
      priority: Math.max(existing?.priority ?? 0, review.priority),
      lastSeen: existing && existing.lastSeen > review.last_seen_at ? existing.lastSeen : review.last_seen_at
    });
  }

  return {
    periodDays: input.days,
    summary: {
      responses: input.messages.length,
      feedback: helpful + negative,
      helpfulRate: percent(helpful, helpful + negative),
      averageConfidence: confidenceCount ? Math.round((confidenceTotal / confidenceCount) * 100) : null,
      escalationRate: percent(handoffMessages.size, input.messages.length),
      reviewResolutionRate: percent(resolvedReviews.length, consideredReviews.length)
    },
    trend,
    intents: Array.from(intents.values())
      .map((item) => ({
        intent: item.intent as AssistantIntent,
        responses: item.responses,
        averageConfidence: item.confidenceCount ? Math.round((item.confidenceTotal / item.confidenceCount) * 100) : null,
        signals: item.signals
      }))
      .sort((a, b) => b.responses - a.responses || b.signals - a.signals)
      .slice(0, 8),
    opportunities: Array.from(opportunityMap.values())
      .sort((a, b) => b.priority - a.priority || b.count - a.count || b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, 8),
    questions: Array.from(questionMap.values())
      .sort((a, b) => b.count - a.count || b.priority - a.priority || b.lastSeen.localeCompare(a.lastSeen))
      .slice(0, 6)
  };
}
