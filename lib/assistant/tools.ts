import "server-only";

import { searchAssistantCatalog, type AssistantCatalogResult } from "@/lib/assistant/catalog-intelligence";
import type { AssistantHistoryItem, AssistantIntent, AssistantState, AssistantToolTrace } from "@/lib/assistant/contracts";
import { retrieveFzacKnowledge, type FzacKnowledgeMatch } from "@/lib/assistant/knowledge";
import { currency } from "@/lib/formatters/currency";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type LatestOrderGuidance = {
  message: string;
  status: string | null;
  createdAt: string | null;
};

export type AssistantToolResult<T> = {
  data: T | null;
  trace: AssistantToolTrace;
};

const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: "pago pendiente",
  PENDING_TRANSFER: "transferencia pendiente",
  PENDING_ADMIN_APPROVAL: "en revisión",
  COORDINATE: "para coordinar",
  PAID: "aprobado",
  CONFIRMED: "confirmado",
  PREPARING: "en preparación",
  READY_FOR_PICKUP: "listo para retirar",
  OUT_FOR_DELIVERY: "en reparto",
  DELIVERED: "entregado",
  COMPLETED: "completado",
  CANCELLED: "cancelado",
  FAILED: "rechazado"
};

function elapsed(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

export async function runCatalogSearchTool(message: string, limit = 4): Promise<AssistantToolResult<AssistantCatalogResult>> {
  const startedAt = performance.now();
  try {
    const data = await searchAssistantCatalog(message, limit);
    const count = data.matches.length || data.categories.length;
    return {
      data,
      trace: { name: "catalog.search", status: count ? "OK" : "EMPTY", durationMs: elapsed(startedAt), resultCount: count }
    };
  } catch {
    return {
      data: null,
      trace: { name: "catalog.search", status: "ERROR", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }
}

export async function runEstimateRecommendationTool(state: AssistantState): Promise<AssistantToolResult<AssistantCatalogResult>> {
  const startedAt = performance.now();
  const queryByProject: Record<string, string> = {
    PAINT: "pintura latex rodillo",
    DRYWALL: "placa yeso perfil tornillo",
    MASONRY: "cemento cal arena"
  };
  const query = queryByProject[state.gathered.project ?? ""];
  if (!query) {
    return {
      data: null,
      trace: { name: "catalog.recommend", status: "EMPTY", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }
  try {
    const data = await searchAssistantCatalog(query, 3);
    return {
      data,
      trace: {
        name: "catalog.recommend",
        status: data.matches.length ? "OK" : "EMPTY",
        durationMs: elapsed(startedAt),
        resultCount: data.matches.length
      }
    };
  } catch {
    return {
      data: null,
      trace: { name: "catalog.recommend", status: "ERROR", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }
}

export async function runKnowledgeTool(
  message: string,
  intent: AssistantIntent,
  history: AssistantHistoryItem[]
): Promise<AssistantToolResult<FzacKnowledgeMatch>> {
  const startedAt = performance.now();
  try {
    const data = await retrieveFzacKnowledge(message, intent, history);
    return {
      data,
      trace: {
        name: "knowledge.retrieve",
        status: data ? "OK" : "EMPTY",
        durationMs: elapsed(startedAt),
        resultCount: data ? 1 : 0
      }
    };
  } catch {
    return {
      data: null,
      trace: { name: "knowledge.retrieve", status: "ERROR", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }
}

export async function runLatestOwnOrderTool(userId: string | null | undefined): Promise<AssistantToolResult<LatestOrderGuidance>> {
  const startedAt = performance.now();
  if (!userId) {
    return {
      data: null,
      trace: { name: "orders.latest", status: "DENIED", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      data: null,
      trace: { name: "orders.latest", status: "UNAVAILABLE", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }

  try {
    const { data, error } = await admin
      .from("orders")
      .select("status,total,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) {
      return {
        data: null,
        trace: { name: "orders.latest", status: "ERROR", durationMs: elapsed(startedAt), resultCount: 0 }
      };
    }
    const order = data?.[0];
    if (!order) {
      return {
        data: {
          message: "No encontré pedidos asociados a tu cuenta. Podés iniciar una compra desde el catálogo y seguirla luego en Mi cuenta.",
          status: null,
          createdAt: null
        },
        trace: { name: "orders.latest", status: "EMPTY", durationMs: elapsed(startedAt), resultCount: 0 }
      };
    }
    const status = statusLabels[String(order.status)] ?? "en seguimiento";
    return {
      data: {
        message: `Tu pedido más reciente figura ${status}, por ${currency(Number(order.total ?? 0))}. Podés ver el detalle y el historial desde Mi cuenta > Compras.`,
        status: String(order.status),
        createdAt: String(order.created_at)
      },
      trace: { name: "orders.latest", status: "OK", durationMs: elapsed(startedAt), resultCount: 1 }
    };
  } catch {
    return {
      data: null,
      trace: { name: "orders.latest", status: "ERROR", durationMs: elapsed(startedAt), resultCount: 0 }
    };
  }
}
