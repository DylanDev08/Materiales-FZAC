export const ASSISTANT_INTENTS = [
  "greeting",
  "delivery",
  "payment",
  "stock",
  "price",
  "estimate",
  "order_status",
  "account",
  "returns",
  "store_policy",
  "human",
  "product_search",
  "fallback"
] as const;

export type AssistantIntent = (typeof ASSISTANT_INTENTS)[number];

export type AssistantHistoryItem = {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type AssistantState = {
  topic: AssistantIntent;
  stage: string;
  gathered: Record<string, string>;
  unresolvedAttempts: number;
  lastReply: string;
};

export type AssistantAction = {
  label: string;
  message?: string;
  href?: string;
};

export type AssistantSource = {
  id: string;
  label: string;
  href: string;
  updatedAt?: string;
};

export type AssistantToolTrace = {
  name: "catalog.search" | "catalog.recommend" | "knowledge.retrieve" | "orders.latest";
  status: "OK" | "EMPTY" | "DENIED" | "UNAVAILABLE" | "ERROR";
  durationMs: number;
  resultCount: number;
};

export type AssistantResponse = {
  message?: string;
  conversationId?: string;
  options?: string[];
  actions?: AssistantAction[];
  sources?: AssistantSource[];
  trace_id?: string;
  knowledge_id?: string;
  handoff_required?: boolean;
  security_notice?: boolean;
};
