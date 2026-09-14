import "server-only";

import { classifyAssistantIntent } from "@/lib/assistant/ml-intents";
import { assessAssistantInput, assistantSafetyReply } from "@/lib/assistant/safety";
import { runCatalogSearchTool } from "@/lib/assistant/tools";
import { currency } from "@/lib/formatters/currency";
import { getPublicSiteUrl } from "@/lib/seo/site";

export type WhatsAppAssistantReply = {
  intent: string;
  message: string;
  options: string[];
  handoffRequired: boolean;
  persistenceText: string;
  securityNotice: boolean;
};

function withOptions(message: string, options: string[]) {
  if (!options.length) return message;
  return `${message}\n\nOpciones:\n${options.map((option, index) => `${index + 1}. ${option}`).join("\n")}`;
}

function availability(product: { availability_status?: string; stock: number }) {
  if (product.availability_status === "CONSULT") return "Disponibilidad a confirmar";
  if (product.availability_status === "OUT_OF_STOCK" || product.stock <= 0) return "Sin stock";
  return "En stock";
}

async function catalogReply(message: string) {
  const result = await runCatalogSearchTool(message, 4);
  if (!result.data?.matches.length) return null;
  const site = getPublicSiteUrl();
  const products = result.data.matches.slice(0, 4).map(({ product }, index) =>
    `${index + 1}. ${product.name}\n${currency(product.price)} por ${product.unit} · ${availability(product)}\n${site}/producto/${encodeURIComponent(product.slug)}`
  );
  return `Encontré estas opciones en Materiales FZAC:\n\n${products.join("\n\n")}`;
}

export async function createWhatsAppReply(rawMessage: string): Promise<WhatsAppAssistantReply> {
  const safety = assessAssistantInput(rawMessage);
  if (safety.decision === "BLOCK") {
    const options = ["Buscar producto", "Ver medios de pago", "Hablar con un asesor"];
    return {
      intent: "security",
      message: withOptions(assistantSafetyReply(safety.reason), options),
      options,
      handoffRequired: false,
      persistenceText: safety.persistenceText,
      securityNotice: true
    };
  }

  const message = safety.safeText || rawMessage.trim().slice(0, 500);
  const normalized = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const classification = classifyAssistantIntent(normalized);
  const intent = classification.intent;
  let reply = "";
  let options: string[] = [];
  let handoffRequired = false;

  if (intent === "greeting") {
    reply = "Hola, soy el asistente de Materiales FZAC. ¿Qué necesitás resolver?";
    options = ["Buscar producto", "Consultar disponibilidad", "Medios de pago", "Hablar con un asesor"];
  } else if (intent === "delivery") {
    reply = "Para calcular un envío necesito la dirección o zona aproximada. Si la tarifa automática todavía no está disponible, coordinamos el valor con un asesor sin inventar un importe. El retiro en el local tiene costo de envío $0.";
    options = ["Enviar zona", "Elegir retiro", "Hablar con un asesor"];
  } else if (intent === "payment") {
    reply = `Podés revisar los medios de pago vigentes en ${getPublicSiteUrl()}/medios-de-pago. El importe y la disponibilidad siempre se validan antes de cobrar.`;
    options = ["Ver medios de pago", "Buscar producto", "Hablar con un asesor"];
  } else if (intent === "order_status") {
    reply = "Para revisar un pedido necesitamos validar tu identidad y la referencia de compra. No mostramos pedidos usando solo el número de WhatsApp. Un asesor puede continuar la verificación.";
    options = ["Tengo el número de pedido", "Hablar con un asesor"];
    handoffRequired = true;
  } else if (intent === "estimate" && /pared|durlock|drywall/.test(normalized)) {
    reply = "Puedo ayudarte a preparar la lista para una pared de construcción en seco. Decime ancho y alto aproximados, y si la querés simple o con aislación. Con esos datos busco placas, montantes, soleras, tornillos, cinta y masilla reales del catálogo.";
    options = ["Enviar medidas", "Ver placas", "Ver perfiles", "Hablar con un asesor"];
  } else if (intent === "human") {
    reply = "Perfecto. Indicame tu nombre, producto o necesidad y, si existe, número de pedido. Así el asesor recibe el contexto completo.";
    options = ["Enviar datos del pedido", "Describir necesidad"];
    handoffRequired = true;
  } else {
    const found = await catalogReply(message);
    if (found) {
      reply = found;
      options = ["Ver más productos", "Consultar disponibilidad", "Hablar con un asesor"];
    } else {
      reply = "No encontré una coincidencia segura en el catálogo. Decime el nombre, marca, medida o uso del producto y vuelvo a buscar sin inventar resultados.";
      options = ["Buscar por medida", "Ver categorías", "Hablar con un asesor"];
    }
  }

  return {
    intent,
    message: withOptions(reply, options),
    options,
    handoffRequired,
    persistenceText: safety.persistenceText,
    securityNotice: safety.redacted
  };
}
