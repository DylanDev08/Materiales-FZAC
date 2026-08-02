export const ASSISTANT_INTENTS = [
  "greeting",
  "delivery",
  "payment",
  "stock",
  "price",
  "estimate",
  "order_status",
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
};
