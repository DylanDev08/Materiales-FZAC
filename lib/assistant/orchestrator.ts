import type { AssistantClassification } from "@/lib/assistant/ml-intents";
import type { AssistantSafetyAssessment } from "@/lib/assistant/safety";

export type AssistantRoute = "SAFETY" | "HANDOFF" | "ESTIMATE" | "CATALOG" | "PRIVATE_ORDER" | "KNOWLEDGE" | "GUIDED";

export type AssistantPlan = {
  route: AssistantRoute;
  criticalEscalation: boolean;
  explicitCatalogRequest: boolean;
  specificDeliveryContext: boolean;
};

const CRITICAL_TERMS = [
  "reclamo urgente",
  "denuncia",
  "no me entregaron",
  "no entregaron",
  "cobro duplicado",
  "me cobraron dos veces",
  "problema de seguridad",
  "reclamo legal"
];

const CATALOG_TERMS = ["catalogo", "categoria", "rubro", "producto", "sku", "marca", "equivalente", "alternativa", "reemplazo"];

function includesAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(term));
}

export function isCriticalAssistantMessage(value: string) {
  return includesAny(value.toLowerCase(), CRITICAL_TERMS);
}

function hasSpecificDeliveryContext(value: string) {
  return /\b\d{1,3}(?:[.,]\d+)?\s*(?:km|kilometros?)\b/.test(value)
    || includesAny(value, ["dentro de rosario", "hasta 30", "mas de 50", "+50", "retiro", "retirar"]);
}

export function createAssistantPlan(input: {
  message: string;
  classification: AssistantClassification;
  safety: AssistantSafetyAssessment;
  authenticated: boolean;
}): AssistantPlan {
  const message = input.message.toLowerCase();
  const criticalEscalation = isCriticalAssistantMessage(message) || input.classification.intent === "human";
  const explicitCatalogRequest = includesAny(message, CATALOG_TERMS);
  const specificDeliveryContext = input.classification.intent === "delivery" && hasSpecificDeliveryContext(message);

  if (input.safety.decision !== "ALLOW") return { route: "SAFETY", criticalEscalation: false, explicitCatalogRequest, specificDeliveryContext };
  if (criticalEscalation) return { route: "HANDOFF", criticalEscalation, explicitCatalogRequest, specificDeliveryContext };
  if (input.classification.intent === "estimate") return { route: "ESTIMATE", criticalEscalation, explicitCatalogRequest, specificDeliveryContext };
  if (["product_search", "stock", "price"].includes(input.classification.intent) || explicitCatalogRequest) {
    return { route: "CATALOG", criticalEscalation, explicitCatalogRequest, specificDeliveryContext };
  }
  if (input.classification.intent === "order_status" && input.authenticated) {
    return { route: "PRIVATE_ORDER", criticalEscalation, explicitCatalogRequest, specificDeliveryContext };
  }
  const knowledgeEligible = ![
    "greeting", "order_status", "account", "stock", "price", "product_search", "estimate"
  ].includes(input.classification.intent);
  if (knowledgeEligible && !specificDeliveryContext) {
    return { route: "KNOWLEDGE", criticalEscalation, explicitCatalogRequest, specificDeliveryContext };
  }
  return { route: "GUIDED", criticalEscalation, explicitCatalogRequest, specificDeliveryContext };
}
