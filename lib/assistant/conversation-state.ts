import "server-only";

import { ASSISTANT_INTENTS, type AssistantIntent, type AssistantState } from "@/lib/assistant/contracts";

const knownIntents = new Set<string>(ASSISTANT_INTENTS);

export function normalizeAssistantText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function includesAny(message: string, terms: string[]) {
  return terms.some((term) => message.includes(term));
}

function safeNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function bounded(value: number | null, minimum: number, maximum: number) {
  return value !== null && value >= minimum && value <= maximum ? value : null;
}

export function deliveryDistance(message: string) {
  const normalized = normalizeAssistantText(message);
  const kilometers = normalized.match(/\b(\d{1,3}(?:[.,]\d+)?)\s?(?:km|kilometros?)\b/);
  const distance = bounded(kilometers ? safeNumber(kilometers[1]) : null, 0, 1000);
  if (distance !== null && distance > 50) return "50KM";
  if (distance !== null && distance <= 30) return "30KM";
  if (includesAny(normalized, ["+50", "mas de 50", "50km", "50 km"])) return "50KM";
  if (includesAny(normalized, ["30km", "30 km", "hasta 30"])) return "30KM";
  if (includesAny(normalized, ["dentro de rosario", "rosario", "zona centro", "zona norte", "zona sur", "zona oeste"])) return "ROSARIO";
  if (includesAny(normalized, ["retiro", "retirar", "busco", "paso por"])) return "PICKUP";
  return null;
}

export function extractAssistantFacts(message: string) {
  const normalized = normalizeAssistantText(message);
  const facts: Record<string, string> = {};

  if (includesAny(normalized, ["pintura", "pintar", "latex", "esmalte"])) facts.project = "PAINT";
  if (includesAny(normalized, ["durlock", "drywall", "placa", "tabique", "cielorraso"])) facts.project = "DRYWALL";
  if (includesAny(normalized, ["cemento", "hormigon", "contrapiso", "carpeta", "losa", "revoque"])) facts.project = "MASONRY";

  const explicitArea = normalized.match(/\b(\d{1,5}(?:[.,]\d+)?)\s?(?:m2|m\u00b2|metros? cuadrados?)\b/);
  const dimensions = normalized.match(/\b(\d{1,4}(?:[.,]\d+)?)\s?(?:m|metros?)?\s?(?:x|por)\s?(\d{1,4}(?:[.,]\d+)?)\s?(?:m|metros?)?\b/);
  const area = bounded(explicitArea ? safeNumber(explicitArea[1]) : null, 0.1, 100_000);
  if (area !== null) facts.areaM2 = String(area);
  if (!facts.areaM2 && dimensions) {
    const width = bounded(safeNumber(dimensions[1]), 0.1, 1000);
    const height = bounded(safeNumber(dimensions[2]), 0.1, 1000);
    if (width !== null && height !== null) {
      facts.widthM = String(width);
      facts.heightM = String(height);
      facts.areaM2 = String(width * height);
    }
  }

  const coatsMatch = normalized.match(/\b([1-6])\s?(?:manos?|capas?)\b/);
  if (coatsMatch) facts.coats = coatsMatch[1];

  const wasteMatch = normalized.match(/\b(\d{1,2})\s?%\s?(?:de\s)?(?:margen|desperdicio|extra)?/);
  const waste = bounded(wasteMatch ? safeNumber(wasteMatch[1]) : null, 0, 30);
  if (waste !== null) facts.wastePercent = String(waste);

  const thicknessMatch = normalized.match(/\b(\d{1,3}(?:[.,]\d+)?)\s?(mm|cm|m)\s?(?:de\s)?espesor\b/);
  if (thicknessMatch) {
    const rawThickness = bounded(safeNumber(thicknessMatch[1]), 0.1, 1000);
    if (rawThickness !== null) {
      const unit = thicknessMatch[2];
      const thicknessM = unit === "mm" ? rawThickness / 1000 : unit === "cm" ? rawThickness / 100 : rawThickness;
      if (thicknessM > 0 && thicknessM <= 2) facts.thicknessM = String(thicknessM);
    }
  }

  const distance = deliveryDistance(normalized);
  if (distance) facts.distance = distance;
  return facts;
}

export function mergeAssistantFacts(previous: AssistantState | null, message: string, intent: AssistantIntent) {
  const sameTopic = previous?.topic === intent || (intent === "fallback" && previous?.topic);
  return {
    ...(sameTopic ? previous?.gathered : {}),
    ...extractAssistantFacts(message)
  };
}

export function parseAssistantState(value: unknown): AssistantState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<AssistantState>;
  if (typeof state.topic !== "string" || !knownIntents.has(state.topic) || typeof state.stage !== "string") return null;
  return {
    topic: state.topic as AssistantIntent,
    stage: state.stage,
    gathered: state.gathered && typeof state.gathered === "object" ? (state.gathered as Record<string, string>) : {},
    unresolvedAttempts: typeof state.unresolvedAttempts === "number" ? state.unresolvedAttempts : 0,
    lastReply: typeof state.lastReply === "string" ? state.lastReply : ""
  };
}

export function deriveAssistantState(input: {
  intent: AssistantIntent;
  message: string;
  reply: string;
  previous: AssistantState | null;
}) {
  const topic = input.intent === "fallback" && input.previous?.topic ? input.previous.topic : input.intent;
  const sameTopic = input.previous?.topic === topic;
  const gathered = mergeAssistantFacts(input.previous, input.message, topic);
  const project = gathered.project;

  let stage = topic === "fallback" ? "NEEDS_CONTEXT" : "ANSWERED";
  if (topic === "delivery") stage = gathered.distance ? "LOCATION_RECEIVED" : "AWAITING_LOCATION";
  if (topic === "stock" || topic === "price") stage = "AWAITING_PRODUCT";
  if (topic === "estimate") {
    if (!project) stage = "AWAITING_PROJECT";
    else if (!gathered.areaM2) stage = "AWAITING_AREA";
    else if (project === "MASONRY" && !gathered.thicknessM) stage = "AWAITING_THICKNESS";
    else stage = "ESTIMATE_READY";
  }

  return {
    topic,
    stage,
    gathered,
    unresolvedAttempts: input.intent === "fallback" ? (sameTopic ? (input.previous?.unresolvedAttempts ?? 0) + 1 : 1) : 0,
    lastReply: input.reply.slice(0, 240)
  } satisfies AssistantState;
}
