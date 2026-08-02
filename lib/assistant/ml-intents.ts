import "server-only";

import rawModel from "@/lib/assistant/generated/intent-model.json";
import type { AssistantIntent } from "@/lib/assistant/contracts";

export type { AssistantIntent } from "@/lib/assistant/contracts";

export type AssistantClassification = {
  intent: AssistantIntent;
  confidence: number;
  margin: number;
  source: "rule" | "model" | "context" | "fallback";
  tokens: string[];
  alternatives: Array<{ intent: AssistantIntent; confidence: number }>;
  engine: string;
};

type IntentModel = {
  schema_version: number;
  engine: string;
  intents: AssistantIntent[];
  total_documents: number;
  vocabulary: string[];
  intent_documents: Record<AssistantIntent, number>;
  total_tokens: Record<AssistantIntent, number>;
  token_counts: Record<AssistantIntent, Record<string, number>>;
};

const model = rawModel as IntentModel;
const stopWords = new Set([
  "a",
  "al",
  "con",
  "de",
  "del",
  "el",
  "en",
  "es",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mi",
  "para",
  "por",
  "que",
  "se",
  "te",
  "un",
  "una",
  "y"
]);

if (
  model.schema_version !== 1 ||
  model.engine !== "FZAC_NAIVE_BAYES_V1" ||
  !Array.isArray(model.intents) ||
  model.total_documents < 1
) {
  throw new Error("El modelo de intenciones FZAC no es compatible con esta version de la aplicacion.");
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function tokenizeAssistantText(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9+\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function includesAny(message: string, terms: string[]) {
  return terms.some((term) => message.includes(term));
}

function ruleIntent(message: string): AssistantIntent | null {
  const normalized = normalize(message).trim();
  if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|hey)(\s+fzac)?[!.?]*$/.test(normalized)) return "greeting";
  if (includesAny(normalized, ["devolucion", "devolver", "reembolso", "garantia", "arrepentimiento", "producto roto", "producto danado"])) {
    return "returns";
  }
  if (includesAny(normalized, ["cobro duplicado", "cobraron dos veces", "datos de tarjeta", "tarjeta", "transferencia", "mercado pago", "mercadopago", "cuotas", "pago rechazado", "pago pendiente"])) {
    return "payment";
  }
  if (includesAny(normalized, ["politica de privacidad", "datos personales", "eliminar mis datos", "terminos y condiciones", "condiciones de compra", "defensa del consumidor", "como comprar", "pasos para comprar"])) {
    return "store_policy";
  }
  if (/\b\d+\s?(km|kilometros?)\b/.test(normalized) || includesAny(normalized, ["envio", "flete", "domicilio", "direccion de entrega", "retiro", "retirar", "rosario", "funes"])) {
    return "delivery";
  }
  if (includesAny(normalized, ["estado del pedido", "estado de la orden", "seguir mi pedido", "seguimiento", "mi pedido", "mi orden", "factura de mi compra"])) {
    return "order_status";
  }
  if (
    /\b\d{1,4}(?:[.,]\d+)?\s?(?:m|metros?)?\s?(?:x|por)\s?\d{1,4}(?:[.,]\d+)?\s?(?:m|metros?)?\b/.test(normalized) ||
    /\b\d+(?:[.,]\d+)?\s?(m2|m\u00b2|metros?)\b/.test(normalized) ||
    includesAny(normalized, ["calcular", "presupuesto", "rendimiento", "cuanto material", "cuantas placas lleva", "margen de desperdicio"])
  ) {
    return "estimate";
  }
  if (includesAny(normalized, ["sin stock", "hay stock", "disponibilidad", "reposicion", "cuantas unidades", "cuantas bolsas", "cuantas placas"])) {
    return "stock";
  }
  if (includesAny(normalized, ["cuanto cuesta", "cuanto sale", "que precio", "precio actual", "precio por", "valor actual", "descuento", "oferta vigente"])) {
    return "price";
  }
  if (includesAny(normalized, ["hablar con una persona", "atenderme una persona", "necesito un asesor", "reclamo legal", "problema de seguridad", "no me entregaron"])) {
    return "human";
  }
  return null;
}

function modelScores(message: string) {
  const tokens = tokenizeAssistantText(message);
  const vocabularySize = Math.max(model.vocabulary.length, 1);
  const scores = model.intents.map((intent) => {
    const prior = (model.intent_documents[intent] ?? 0) / model.total_documents;
    const counts = model.token_counts[intent] ?? {};
    const total = model.total_tokens[intent] ?? 0;
    const score = tokens.reduce((sum, token) => {
      const likelihood = ((counts[token] ?? 0) + 1) / (total + vocabularySize);
      return sum + Math.log(likelihood);
    }, Math.log(prior || 1 / model.total_documents));
    return { intent, score };
  });

  scores.sort((left, right) => right.score - left.score);
  const best = scores[0] ?? { intent: "fallback" as const, score: 0 };
  const runnerUp = scores[1]?.score ?? best.score - 1;
  const margin = best.score - runnerUp;
  const confidence = 1 / (1 + Math.exp(-margin));
  return { tokens, scores, best, margin, confidence };
}

function alternatives(scores: Array<{ intent: AssistantIntent; score: number }>) {
  const maxScore = scores[0]?.score ?? 0;
  const weights = scores.map((item) => ({ ...item, weight: Math.exp(item.score - maxScore) }));
  const total = weights.reduce((sum, item) => sum + item.weight, 0) || 1;
  return weights.slice(0, 3).map((item) => ({ intent: item.intent, confidence: item.weight / total }));
}

export function classifyAssistantIntent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): AssistantClassification {
  const current = modelScores(message);
  const explicitIntent = ruleIntent(message);
  if (explicitIntent) {
    return {
      intent: explicitIntent,
      confidence: 0.99,
      margin: current.margin,
      source: "rule",
      tokens: current.tokens,
      alternatives: alternatives(current.scores),
      engine: model.engine
    };
  }

  const isBriefContinuation = current.tokens.length <= 2;
  if (isBriefContinuation && current.confidence < 0.6) {
    const previousUserMessage = history.filter((item) => item.role === "user").at(-1)?.content ?? "";
    if (previousUserMessage) {
      const previous = modelScores(previousUserMessage);
      const previousRule = ruleIntent(previousUserMessage);
      const contextualIntent = previousRule ?? (previous.confidence >= 0.55 ? previous.best.intent : null);
      if (contextualIntent && contextualIntent !== "fallback") {
        return {
          intent: contextualIntent,
          confidence: Math.min(0.78, Math.max(0.56, previous.confidence)),
          margin: previous.margin,
          source: "context",
          tokens: current.tokens,
          alternatives: alternatives(previous.scores),
          engine: model.engine
        };
      }
    }
  }

  const intent = current.confidence >= 0.54 ? current.best.intent : "fallback";
  return {
    intent,
    confidence: current.confidence,
    margin: current.margin,
    source: intent === "fallback" ? "fallback" : "model",
    tokens: current.tokens,
    alternatives: alternatives(current.scores),
    engine: model.engine
  };
}
