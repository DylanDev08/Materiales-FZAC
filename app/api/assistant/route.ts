import { ZodError, z } from "zod";
import {
  classifyAssistantIntent,
  type AssistantClassification
} from "@/lib/assistant/ml-intents";
import type {
  AssistantAction,
  AssistantHistoryItem,
  AssistantIntent,
  AssistantSource,
  AssistantState
} from "@/lib/assistant/contracts";
import {
  deliveryDistance,
  deriveAssistantState,
  normalizeAssistantText,
  parseAssistantState
} from "@/lib/assistant/conversation-state";
import { createEstimateGuidance } from "@/lib/assistant/estimators";
import { retrieveFzacKnowledge } from "@/lib/assistant/knowledge";
import { searchAssistantCatalog } from "@/lib/assistant/catalog-intelligence";
import { refineGroundedAssistantAnswer } from "@/lib/assistant/language-model";
import { enqueueAssistantReview, type AssistantReviewReason } from "@/lib/assistant/quality";
import { getCurrentUser } from "@/lib/auth/get-user";
import { currency } from "@/lib/formatters/currency";
import { getMarketPriceSummary } from "@/lib/market-pricing/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { jsonError } from "@/lib/utils/api";
import { getAdminConsolePath } from "@/lib/utils/env";
import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { validateJsonMutationRequest } from "@/lib/utils/request-security";
import { hasSqlMeta, sanitizeSearchTerm } from "@/lib/validations/security";
import type { Product } from "@/types/domain";

type ConversationContext = {
  conversationId: string | null;
  history: AssistantHistoryItem[];
  state: AssistantState | null;
  waitingAdmin: boolean;
};

const schema = z.object({
  message: z.string().trim().min(1).max(500),
  conversationId: z.string().uuid().nullable().optional(),
  visitorId: z.string().uuid().optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(600), createdAt: z.string().optional() }))
    .max(12)
    .optional()
});

function needsHuman(message: string) {
  return [
    "reclamo urgente",
    "denuncia",
    "no me entregaron",
    "no entregaron",
    "cobro duplicado",
    "me cobraron dos veces",
    "datos de tarjeta",
    "problema de seguridad",
    "reclamo legal"
  ].some((term) => message.includes(term));
}

function includesAny(message: string, terms: string[]) {
  return terms.some((term) => message.includes(term));
}

const defaultOptions = ["Comprar materiales", "Consultar envio", "Medios de pago", "Estado de pedido"];
const deliveryTerms = ["envio", "entrega", "zona", "flete", "domicilio", "distancia", "km", "kilometro", "direccion"];
const paymentTerms = ["pago", "pagar", "tarjeta", "mercado", "mercadopago", "transferencia", "comprobante", "cuotas", "debito", "credito"];
const marketReferenceTerms = ["precio de mercado", "referencia de mercado", "comparar precio", "comparacion de precio", "valor de mercado"];

function fourOptions(options: string[]) {
  const uniqueOptions = Array.from(new Set(options.map((option) => option.trim()).filter(Boolean)));
  for (const fallback of defaultOptions) {
    if (uniqueOptions.length >= 4) break;
    if (!uniqueOptions.includes(fallback)) uniqueOptions.push(fallback);
  }
  return uniqueOptions.slice(0, 4);
}

function userContext(message: string, history: AssistantHistoryItem[] = []) {
  const words = message.trim().split(/\s+/).filter(Boolean);
  if (words.length > 2) return message;
  const previous = history.filter((item) => item.role === "user").at(-1)?.content.toLowerCase() ?? "";
  return `${previous} ${message}`.trim();
}

function recentAssistantReplies(history: AssistantHistoryItem[] = []) {
  return history
    .filter((item) => item.role === "assistant")
    .slice(-4)
    .map((item) => item.content.trim());
}

function chooseReply(candidates: string[], history: AssistantHistoryItem[] = []) {
  const recent = recentAssistantReplies(history);
  return candidates.find((candidate) => !recent.includes(candidate)) ?? candidates[recent.length % candidates.length] ?? candidates[0];
}

function currentMessageLooksLikePayment(message: string) {
  return includesAny(message, paymentTerms) || includesAny(message, ["pagar online", "pagar con tarjeta", "pago pendiente", "pago rechazado"]);
}

function guidedReply(message: string, intent: AssistantIntent, history: AssistantHistoryItem[] = []) {
  if (intent === "greeting" || includesAny(message, ["hola", "buenas", "buen dia", "buenas tardes", "buenas noches", "hey"])) {
    return {
      message: chooseReply(
        [
          "Hola, soy AI Chatbot FZAC. Te puedo ayudar a elegir materiales, revisar como comprar, entender pagos, coordinar retiro o preparar datos para envio sin esperar a un asesor.",
          "Hola. Decime que estas buscando y te guio: materiales, stock, pago, envio, retiro o estado de pedido. Si ya tenes una medida o producto, mejor todavia.",
          "Buenas. Puedo ayudarte a resolver la compra paso a paso. Contame si queres comprar, calcular materiales, pagar, cotizar envio o revisar un pedido."
        ],
        history
      ),
      options: defaultOptions
    };
  }

  if (currentMessageLooksLikePayment(message) || intent === "payment") {
    return {
      message: chooseReply(
        [
          "En checkout podes pagar online con Mercado Pago, generar un pedido por transferencia o coordinar por WhatsApp. Solo Mercado Pago abre el sitio del proveedor; FZAC no guarda datos de tarjeta.",
          "Para pagar, completa los datos del comprador y revisa stock. Mercado Pago redirige al pago online; transferencia y WhatsApp generan un pedido pendiente para continuar por su propio canal.",
          "El stock se descuenta cuando el pago queda aprobado o cuando administracion confirma el pedido. Un pago pendiente o rechazado no descuenta unidades."
        ],
        history
      ),
      options: fourOptions(["Pagar con Mercado Pago", "Solicitar transferencia", "Coordinar por WhatsApp", "Pago pendiente"])
    };
  }

  if (intent === "delivery" || includesAny(message, deliveryTerms)) {
    const distance = deliveryDistance(message);
    if (distance === "ROSARIO") {
      return {
        message: chooseReply(
          [
            "Dentro de Rosario, carga calle, numero, ciudad y telefono en checkout. Con esa direccion el sistema puede solicitar cotizacion de envio si la API de distancia y tarifa esta configurada.",
            "Para Rosario, el dato clave es la direccion exacta. Si el envio automatico esta habilitado, se cotiza antes de pagar; si no, queda marcado para coordinar sin cobrar flete inventado.",
            "Si estas en Rosario, podes avanzar con envio a domicilio. Antes del pago se valida stock y se intenta cotizar el flete con datos reales de distancia."
          ],
          history
        ),
        options: fourOptions(["Cargar direccion", "Pagar con Mercado Pago", "Pagar con tarjeta", "Prefiero retirar"])
      };
    }
    if (distance === "30KM") {
      return {
        message: chooseReply(
          [
            "Hasta 30 km de Rosario se puede cotizar con direccion exacta, siempre que este activa la API de distancia y la tarifa vigente de FZAC. Sin esos datos, no conviene cobrar un valor falso.",
            "Para envios de hasta 30 km, carga localidad, calle y numero. El checkout calcula distancia y aplica la tarifa vigente configurada por FZAC antes de habilitar el pago.",
            "Si estas a menos de 30 km, necesito direccion precisa para calcular kilometros reales. Con eso el sistema intenta cotizar flete y mostrarlo en el resumen."
          ],
          history
        ),
        options: fourOptions(["Cargar direccion", "Pagar con tarjeta", "Ver medios de pago", "Retiro coordinado"])
      };
    }
    if (distance === "50KM") {
      return {
        message: chooseReply(
          [
            "Para mas de 50 km conviene revisar el caso por volumen, peso y disponibilidad de reparto. El checkout puede guardar tu pedido, pero el flete deberia confirmarse antes de pagar.",
            "Mas de 50 km requiere validacion operativa. Arma el carrito y deja direccion/notas; si el envio no esta automatizado, FZAC lo confirma antes de cerrar condiciones.",
            "Para distancias largas no fuerzo una tarifa. Te conviene cargar el pedido y coordinar flete especial segun materiales, descarga y disponibilidad."
          ],
          history
        ),
        options: fourOptions(["Armar carrito", "Pedir alternativa", "Retiro en FZAC", "Medios de pago"])
      };
    }
    if (distance === "PICKUP") {
      return {
        message: chooseReply(
          [
            "Perfecto. Elegi retiro coordinado en checkout. FZAC valida stock, prepara el pedido y avisa cuando este listo para pasar a buscar.",
            "Para retirar, no se suma envio. Revisa cantidades, datos de contacto y medio de pago; cuando se aprueba la compra, FZAC prepara el pedido.",
            "Retiro coordinado es la opcion mas directa si pasas por FZAC. El stock se descuenta solo cuando el pago queda aprobado."
          ],
          history
        ),
        options: fourOptions(["Ver carrito", "Pagar online", "Consultar stock", "Seguir comprando"])
      };
    }
    return {
      message: chooseReply(
        [
          "Para orientarte con el envio necesito una distancia o zona aproximada. Elegi una opcion y sigo con el calculo operativo.",
          "Decime si estas dentro de Rosario, hasta 30 km o mas lejos. Con direccion exacta el checkout puede cotizar si la tarifa real esta configurada.",
          "Para calcular envio no uso valores inventados: necesito direccion o rango de distancia y una tarifa real configurada por FZAC."
        ],
        history
      ),
      options: fourOptions(["Dentro de Rosario", "Hasta 30 km", "+50 km", "Retiro en FZAC"])
    };
  }

  if (intent === "stock" || intent === "price" || includesAny(message, ["stock", "disponible", "cantidad", "faltante", "reposicion", "precio", "cuanto sale", "cuanto cuesta"])) {
    return {
      message:
        "Decime el nombre del producto para consultar precio y stock visibles en el catalogo. El checkout vuelve a validar ambos datos antes de crear la orden.",
      options: fourOptions(["Buscar producto", "Consultar stock", "Ver ofertas", "Ver carrito"])
    };
  }

  if (intent === "estimate" || includesAny(message, ["presupuesto", "calcular", "m2", "metro", "obra", "construir", "reparar", "material"])) {
    return {
      message:
        "Para armar una recomendacion necesito superficie aproximada, uso interior o exterior, tipo de material y terminacion. Con esos datos puedo sugerir una lista inicial y margen de compra.",
      options: fourOptions(["Pintura", "Placas", "Cemento y arena", "Plomería"])
    };
  }

  if (intent === "order_status" || includesAny(message, ["pedido", "orden", "estado", "comprobante", "factura", "compra"])) {
    return {
      message:
        "El estado del pedido se revisa desde Mi cuenta > Pedidos. Si el pago esta aprobado, administracion actualiza preparacion, retiro, entrega o comprobante. Usa el email de compra para ubicarlo.",
      options: fourOptions(["Ver mis pedidos", "Pago pendiente", "Coordinar retiro", "Problema con pedido"])
    };
  }

  if (intent === "account" || includesAny(message, ["mi cuenta", "mis datos", "mi perfil", "mis direcciones", "cambiar contrasena"])) {
    return {
      message: chooseReply(
        [
          "Desde Mi cuenta podés actualizar nombre, teléfono, foto y direcciones. Esos datos se reutilizan en checkout; tu contraseña nunca queda visible para FZAC.",
          "Tu cuenta reúne compras, productos, direcciones, conversaciones y solicitudes. En Ajustes podés completar el perfil y pedir un enlace seguro para cambiar la contraseña.",
          "Para preparar una compra más rápido, completá teléfono y una dirección desde Mi cuenta. El email de acceso se administra con tu método de ingreso seguro."
        ],
        history
      ),
      options: fourOptions(["Abrir mi cuenta", "Editar mis datos", "Mis direcciones", "Cambiar contraseña"])
    };
  }

  if (intent === "returns" || includesAny(message, ["devolucion", "devolver", "cambio", "garantia"])) {
    return {
      message:
        "Para cambios o devoluciones, conserva el comprobante e indica producto, motivo y estado del material. Si fue pedido especial o ya se uso en obra, FZAC revisa el caso antes de aprobar el cambio.",
      options: fourOptions(["Tengo comprobante", "Producto danado", "Me equivoque", "Ver terminos"])
    };
  }

  if (intent === "human" || includesAny(message, ["humano", "persona", "asesor", "vendedor", "whatsapp", "llamar"])) {
    return {
      message:
        "Antes de derivarte, puedo intentar resolverlo aca. Elegi el motivo y te doy pasos claros; si queda algo sensible, recien ahi conviene contactar a FZAC con el carrito o numero de pedido.",
      options: fourOptions(["Problema con pago", "Envio o retiro", "Stock o producto", "Estado de pedido"])
    };
  }

  return {
    message:
      "Te ayudo. Contame producto, cantidad aproximada y para que obra lo necesitas. Si preferis, elegi una opcion y seguimos paso a paso.",
    options: defaultOptions
  };
}

function advisoryReply(message: string, history: Array<{ role: "user" | "assistant"; content: string }> = []) {
  const context = userContext(message, history);

  if (needsHuman(message)) {
    return "Dejo esta conversacion marcada para atencion humana. Para resolverlo mas rapido, escribi a FZAC por WhatsApp con producto, cantidad, zona y si necesitas retiro o envio. El equipo puede confirmar stock real, condiciones de entrega y pedidos especiales.";
  }

  if (includesAny(context, ["stock", "disponible", "cantidad", "faltante"])) {
    return chooseReply(
      [
        "El stock visible del catalogo es orientativo y el checkout lo valida contra base de datos antes de crear la orden. Si un producto figura sin stock, proba bajar cantidad o buscar un equivalente.",
        "Si te falta stock, conviene bajar cantidad, revisar productos similares o dejar la consulta con el producto exacto. No se genera compra aprobada si el stock no alcanza.",
        "Para stock, pasame producto y cantidad. El sistema valida disponibilidad real antes del pago y evita descontar unidades si la orden no queda aprobada."
      ],
      history
    );
  }

  if (includesAny(context, ["pago", "tarjeta", "mercado", "transferencia", "comprobante"])) {
    return chooseReply(
      [
        "FZAC inicia el pago desde servidor seguro con proveedores externos. No guardamos numeros de tarjeta ni CVV. Cuando el proveedor confirma el pago, el sistema confirma la orden, descuenta stock y genera el comprobante.",
        "Podes pagar con Mercado Pago o tarjeta si la integracion esta configurada. Para tarjeta se pide identidad del titular y se tokeniza la tarjeta con el proveedor.",
        "El pago genera una sola transaccion por intento. Si se aprueba, queda comprobante; si falla o queda pendiente, no se descuenta stock."
      ],
      history
    );
  }

  if (includesAny(context, ["envio", "entrega", "zona", "flete", "domicilio"])) {
    return chooseReply(
      [
        "El envio se puede cotizar automaticamente solo si estan configuradas la API de distancia y la tarifa vigente de FZAC. Sin eso, el checkout no inventa precio y deja el envio para coordinar.",
        "Carga direccion completa en checkout. Si estas dentro de Rosario o hasta 30 km y la API esta activa, el sistema intenta calcular distancia y costo antes del pago.",
        "Para envio necesito direccion exacta, localidad y telefono. El costo depende de distancia real y tarifa vigente; si falta configuracion, queda a confirmar por FZAC."
      ],
      history
    );
  }

  if (includesAny(context, ["retiro", "retirar", "local"])) {
    return "Para retiro, elegi Retiro coordinado. FZAC prepara el pedido y avisa cuando este disponible. Antes de pagar revisa SKU, cantidad, unidad de venta y telefono, asi administracion puede contactarte sin demoras.";
  }

  if (includesAny(context, ["devolucion", "devolver", "cambio", "garantia"])) {
    return "Para cambios o devoluciones, conserva el comprobante e informa orden, producto y motivo. En materiales de obra se revisa estado, embalaje, uso y si fue pedido especial. Si el caso es urgente, conviene derivarlo a WhatsApp con fotos.";
  }

  if (includesAny(context, ["presupuesto", "calcular", "m2", "metro", "obra", "construir", "reparar", "material"])) {
    return "Para orientarte con materiales necesito superficie aproximada, uso interior/exterior, tipo de obra y terminacion buscada. Como regla practica, conviene sumar margen por desperdicio y validar unidad de venta. Pasame medidas y rubro, por ejemplo placa, pintura, cemento o plomeria, y te armo una lista inicial para revisar.";
  }

  if (includesAny(context, ["pedido", "orden", "estado", "comprobante", "factura"])) {
    return "El estado del pedido se consulta desde tu cuenta. Si el pago ya fue confirmado, administracion actualiza preparacion, retiro, entrega o comprobante. Para acelerar una consulta, envia numero de orden y email de compra por WhatsApp.";
  }

  return chooseReply(
    [
      "Soy AI Chatbot FZAC. Te ayudo a elegir materiales, entender stock, pagos, retiros, envios y estado de pedidos. Contame producto, cantidad y tipo de obra para darte una recomendacion concreta.",
      "Puedo orientarte mejor si me das un dato especifico: material, medida, cantidad, direccion de envio o estado del pedido. Con eso respondo sin vueltas.",
      "Decime que queres resolver ahora: comprar materiales, calcular cantidad, pagar, cotizar envio o revisar una orden. Sigo el tema que elijas."
    ],
    history
  );
}

async function resolveConversationContext(input: {
  conversationId?: string | null;
  visitorId?: string;
  userId?: string | null;
  clientHistory: AssistantHistoryItem[];
}): Promise<ConversationContext> {
  const fallback: ConversationContext = {
    conversationId: null,
    history: input.clientHistory.slice(-12),
    state: null,
    waitingAdmin: false
  };
  const admin = getSupabaseAdminClient();
  if (!admin || !input.conversationId) return fallback;

  const { data: conversation } = await admin
    .from("chat_conversations")
    .select("id,user_id,visitor_id,status")
    .eq("id", input.conversationId)
    .maybeSingle();
  if (!conversation) return fallback;

  const ownsConversation = input.userId
    ? conversation.user_id === input.userId
    : !conversation.user_id && Boolean(input.visitorId) && conversation.visitor_id === input.visitorId;
  if (!ownsConversation) return fallback;

  const { data: rows } = await admin
    .from("chat_messages")
    .select("role,content,metadata,created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(12);
  const chronological = [...(rows ?? [])].reverse();
  const history = chronological
    .filter((row) => row.role === "USER" || row.role === "ASSISTANT")
    .map((row) => ({
      role: row.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: row.content,
      createdAt: row.created_at
    }));
  const lastAssistant = [...chronological].reverse().find((row) => row.role === "ASSISTANT");
  const metadata = lastAssistant?.metadata && typeof lastAssistant.metadata === "object"
    ? (lastAssistant.metadata as Record<string, unknown>)
    : null;

  return {
    conversationId: conversation.id,
    history: history.length ? history : fallback.history,
    state: parseAssistantState(metadata?.assistant_state),
    waitingAdmin: conversation.status === "WAITING_ADMIN"
  };
}

function actionFor(label: string): AssistantAction {
  const normalized = normalizeAssistantText(label);
  if (normalized.includes("mis pedidos") || normalized.includes("estado de pedido")) return { label, href: "/cuenta/pedidos" };
  if (normalized.includes("direccion")) return { label, href: "/cuenta/direcciones" };
  if (normalized.includes("mi cuenta")) return { label, href: "/cuenta" };
  if (normalized.includes("editar mis datos")) return { label, href: "/cuenta/ajustes" };
  if (normalized.includes("contrasena")) return { label, href: "/recuperar" };
  if (normalized.includes("carrito")) return { label, href: "/carrito" };
  if (normalized.includes("terminos")) return { label, href: "/terminos" };
  if (normalized.includes("categorias")) return { label, href: "/categorias" };
  if (normalized.includes("mercado pago") || normalized.includes("transferencia")) return { label, href: "/checkout" };
  if (normalized.includes("ver productos") || normalized.includes("seguir comprando") || normalized.includes("armar carrito")) {
    return { label, href: "/productos" };
  }
  return { label, message: label };
}

async function ownOrderStatus(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("orders")
    .select("status,total,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
  const order = data?.[0];
  if (!order) return "No encontre pedidos asociados a tu cuenta. Podes iniciar una compra desde el catalogo y seguirla luego en Mi cuenta.";
  const statusLabels: Record<string, string> = {
    PENDING_PAYMENT: "pago pendiente",
    PENDING_TRANSFER: "transferencia pendiente",
    PENDING_ADMIN_APPROVAL: "en revision",
    COORDINATE: "para coordinar",
    PAID: "aprobado",
    CANCELLED: "cancelado",
    FAILED: "rechazado"
  };
  const status = statusLabels[order.status] ?? "en seguimiento";
  return `Tu pedido mas reciente figura ${status}, por ${currency(Number(order.total ?? 0))}. Podes ver el detalle y el historial desde Mi cuenta > Compras.`;
}

function productTechnicalReply(product: Product) {
  const description = product.description.trim().replace(/\s+/g, " ").slice(0, 220);
  const specifications = Object.entries(product.specifications ?? {})
    .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
    .slice(0, 4)
    .map(([key, value]) => `${key.replace(/_/g, " ")}: ${String(value)}`)
    .join(", ");
  const details = [description, specifications ? `Ficha visible: ${specifications}.` : ""].filter(Boolean).join(" ");
  return `${product.name}: ${details || "No tiene una ficha técnica publicada todavía."} Precio visible ${currency(product.price)} y stock visible ${product.stock} ${product.unit}. Confirmá envase, unidad de venta y uso indicado por el fabricante antes de comprar.`;
}

async function marketReferenceReply(message: string, product: Product) {
  if (!includesAny(message, marketReferenceTerms)) return "";
  const summary = await getMarketPriceSummary(product);
  if (summary.status !== "READY" || summary.median === null || summary.minimum === null || summary.maximum === null) {
    return " No hay suficientes referencias vigentes y comparables para publicar un valor de mercado confiable. No voy a inventar una comparacion.";
  }
  const date = summary.observedAt?.slice(0, 10) ?? "fecha no disponible";
  const position = summary.position === "BELOW"
    ? "El precio FZAC esta por debajo de esa mediana."
    : summary.position === "ABOVE"
      ? "El precio FZAC esta por encima de esa mediana."
      : "El precio FZAC esta alineado con esa mediana.";
  return ` Referencia informativa para la misma unidad: mediana ${currency(summary.median)}, rango ${currency(summary.minimum)} a ${currency(summary.maximum)}, basada en ${summary.observations} observaciones de ${summary.sources} fuentes al ${date}, con confianza ${summary.confidence}%. ${position} El precio valido para comprar es el publicado por FZAC y se vuelve a validar en checkout; el asistente nunca lo modifica.`;
}

async function persistConversation(input: {
  conversationId: string | null;
  visitorId?: string;
  userId?: string | null;
  message: string;
  reply: string;
  intent: AssistantIntent;
  classification: AssistantClassification;
  state: AssistantState;
  options: string[];
  sources?: AssistantSource[];
  knowledgeId?: string;
  traceId?: string;
  waitingAdmin: boolean;
  wasWaitingAdmin: boolean;
  skipPersistence?: boolean;
}) {
  if (input.skipPersistence || process.env.ASSISTANT_PERSISTENCE_ENABLED?.trim().toLowerCase() === "false") {
    return input.conversationId;
  }
  const admin = getSupabaseAdminClient();
  if (!admin || (!input.userId && !input.visitorId)) return input.conversationId;
  const adminPath = getAdminConsolePath();

  try {
    let conversationId = input.conversationId;
    const status = input.waitingAdmin ? "WAITING_ADMIN" : "OPEN";

    if (!conversationId) {
      const { data, error } = await admin
        .from("chat_conversations")
        .insert({
          user_id: input.userId ?? null,
          visitor_id: input.userId ? null : input.visitorId ?? null,
          channel: "AI",
          status,
          subject: input.message.slice(0, 80),
          updated_at: new Date().toISOString()
        })
        .select("id")
        .single();
      if (error || !data?.id) return null;
      conversationId = data.id;
    } else {
      await admin
        .from("chat_conversations")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    const { data: savedMessages } = await admin.from("chat_messages").insert([
      {
        conversation_id: conversationId,
        sender_id: input.userId ?? null,
        role: "USER",
        content: input.message,
        metadata: {
          intent: input.intent,
          confidence: input.classification.confidence,
          classification_source: input.classification.source,
          engine: input.classification.engine
        }
      },
      {
        conversation_id: conversationId,
        role: "ASSISTANT",
        content: input.reply,
        metadata: {
          assistant_state: input.state,
          options: input.options.slice(0, 4),
          knowledge_sources: input.sources?.slice(0, 3) ?? [],
          knowledge_id: input.knowledgeId ?? null,
          trace_id: input.traceId ?? null,
          engine: input.classification.engine,
          classification_source: input.classification.source,
          confidence: input.classification.confidence
        }
      }
    ]).select("id,role");

    const userMessageId = savedMessages?.find((message) => message.role === "USER")?.id ?? null;
    const assistantMessageId = savedMessages?.find((message) => message.role === "ASSISTANT")?.id ?? null;
    if (assistantMessageId && conversationId) {
      const reviewConversationId = conversationId;
      const reviewReasons = new Set<AssistantReviewReason>();
      if (input.waitingAdmin) reviewReasons.add("HANDOFF");
      if (input.state.unresolvedAttempts >= 2) reviewReasons.add("UNRESOLVED");
      if (
        !input.waitingAdmin
        && input.intent !== "greeting"
        && input.classification.confidence < 0.52
      ) {
        reviewReasons.add("LOW_CONFIDENCE");
      }
      await Promise.all(Array.from(reviewReasons, (reason) => enqueueAssistantReview({
        conversationId: reviewConversationId,
        userMessageId,
        assistantMessageId,
        knowledgeSlug: input.knowledgeId ?? null,
        intent: input.intent,
        reason,
        confidence: input.classification.confidence
      })));
    }

    if (input.waitingAdmin && !input.wasWaitingAdmin) {
      await admin.from("notifications").insert({
        target_role: "ADMIN",
        type: "CHAT_WAITING_ADMIN",
        title: "Chat requiere atencion",
        message: input.message.slice(0, 140),
        link_to: `${adminPath}/chats?conversation=${conversationId}`
      });
    }

    return conversationId;
  } catch {
    return input.conversationId;
  }
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "assistant"), 30, 60_000);
  const mutation = validateJsonMutationRequest(request, 16 * 1024);
  if (!limit.ok) return jsonError("Demasiadas consultas al asistente.", 429, retryAfterHeaders(limit));
  if (!mutation.ok) return jsonError(mutation.message, mutation.status);

  let payload: z.infer<typeof schema>;
  try {
    payload = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof ZodError) return jsonError(error.issues[0]?.message ?? "Consulta invalida.", 422);
    return jsonError("No pudimos leer la consulta.", 400);
  }
  if (hasSqlMeta(payload.message)) return jsonError("La consulta contiene caracteres no permitidos.", 422);

  const message = sanitizeSearchTerm(payload.message, 500).toLowerCase();
  const user = await getCurrentUser();
  const readOnlyLoadTest = process.env.NODE_ENV !== "production" && request.headers.get("x-fzac-load-test") === "readonly";
  const conversation = await resolveConversationContext({
    conversationId: payload.conversationId,
    visitorId: payload.visitorId,
    userId: user?.id ?? null,
    clientHistory: payload.history ?? []
  });
  const classification = classifyAssistantIntent(message, conversation.history);
  const criticalEscalation = needsHuman(message);
  const genericTerms = new Set([
    "comprar", "buscar", "quiero", "necesito", "material", "producto", "precio", "cuanto", "sale", "cuesta",
    "stock", "disponible", "disponibilidad", "unidades", "unidad", "tenes", "tienen", "oferta", "valor",
    "que", "cual", "cuales", "tiene", "hay", "algun", "alguna", "dame", "mostrame", "mostrar",
    "para", "con", "del", "los", "las", "una", "uno", "por", "favor", "ficha", "tecnica", "tecnico",
    "especificacion", "especificaciones", "rendimiento", "sirve", "usar", "uso", "detalle", "detalles"
  ]);
  const normalizedForSearch = normalizeAssistantText(message);
  const query = normalizedForSearch
    .split(/\s+/)
    .map((word) => word.replace(/[^a-z0-9-]/g, ""))
    .filter((word) => word.length > 2 && !genericTerms.has(word))
    .slice(0, 3)
    .join(" ");
  const explicitCatalogRequest = includesAny(normalizedForSearch, [
    "catalogo", "categoria", "rubro", "producto", "sku", "marca", "equivalente", "alternativa", "reemplazo"
  ]);
  const productSearchAllowed = ["product_search", "stock", "price"].includes(classification.intent) || explicitCatalogRequest;

  if (classification.intent === "estimate" && !criticalEscalation) {
    const guidance = createEstimateGuidance(message, conversation.state);
    const state = deriveAssistantState({
      intent: classification.intent,
      message,
      reply: guidance.message,
      previous: conversation.state
    });
    state.stage = guidance.stage;
    state.gathered = guidance.gathered;
    const options = guidance.actions.map((action) => action.label).slice(0, 4);
    const conversationId = await persistConversation({
      conversationId: conversation.conversationId,
      visitorId: payload.visitorId,
      userId: user?.id ?? null,
      message: payload.message,
      reply: guidance.message,
      intent: classification.intent,
      classification,
      state,
      options,
      waitingAdmin: false,
      wasWaitingAdmin: conversation.waitingAdmin,
      skipPersistence: readOnlyLoadTest
    });
    return Response.json({
      intent: classification.intent,
      message: guidance.message,
      conversationId,
      waitingAdmin: false,
      options,
      actions: guidance.actions.slice(0, 4),
      handoff_required: false,
      suggested_products: []
    });
  }

  if (!criticalEscalation && productSearchAllowed) {
    const catalog = await searchAssistantCatalog(message, 4);
    if (catalog.mode === "overview") {
      const listedCategories = catalog.categories.slice(0, 6);
      const reply = listedCategories.length
        ? `El catálogo FZAC está organizado en ${listedCategories.map((category) => `${category.name} (${category.productCount})`).join(", ")}. Los productos, precios y stock se leen de la tienda en el momento de tu consulta.`
        : "El catálogo activo todavía no tiene rubros con productos publicados.";
      const actions: AssistantAction[] = listedCategories
        .slice(0, 3)
        .map((category) => ({ label: category.name, href: `/categoria/${category.slug}` }));
      actions.push({ label: "Ver catálogo", href: "/productos" });
      const sources: AssistantSource[] = listedCategories.slice(0, 3).map((category) => ({
        id: `category-${category.slug}`,
        label: category.name,
        href: `/categoria/${category.slug}`
      }));
      const options = actions.map((action) => action.label).slice(0, 4);
      const state = deriveAssistantState({ intent: classification.intent, message, reply, previous: conversation.state });
      const conversationId = await persistConversation({
        conversationId: conversation.conversationId,
        visitorId: payload.visitorId,
        userId: user?.id ?? null,
        message: payload.message,
        reply,
        intent: classification.intent,
        classification,
        state,
        options,
        sources,
        waitingAdmin: false,
        wasWaitingAdmin: conversation.waitingAdmin,
        skipPersistence: readOnlyLoadTest
      });
      return Response.json({
        intent: classification.intent,
        message: reply,
        conversationId,
        options,
        actions: actions.slice(0, 4),
        sources,
        handoff_required: false,
        suggested_products: []
      });
    }

    const products = catalog.matches.map((match) => match.product);
    if (catalog.mode === "products" && products.length) {
      const wantsTechnicalDetails = includesAny(normalizedForSearch, [
        "ficha", "tecnica", "especificacion", "rendimiento", "medida", "espesor", "contenido", "sirve", "uso"
      ]);
      const baseReply = wantsTechnicalDetails && products.length === 1
        ? productTechnicalReply(products[0])
        : `${catalog.equivalentRequest ? "Tomando el primer resultado como referencia, estas son alternativas del mismo rubro o unidad de venta: " : "Encontré estas opciones del catálogo: "}${products
            .map((product) => `${product.name} a ${currency(product.price)}, con ${product.stock} ${product.unit} visibles`)
            .join("; ")}. ${catalog.equivalentRequest ? "Confirmá medidas, rendimiento y ficha técnica antes de reemplazar un material." : "Revisá la unidad de venta y sumá margen si es para una obra."}`;
      const marketReference = await marketReferenceReply(normalizedForSearch, products[0]);
      const groundedDraft = `${baseReply}${marketReference}`;
      const language = await refineGroundedAssistantAnswer({
        question: payload.message,
        draft: groundedDraft,
        facts: products.map((product) => `${product.name}; precio ${currency(product.price)}; stock ${product.stock}; unidad ${product.unit}`)
      });
      const reply = language.text;
      const sources: AssistantSource[] = products.slice(0, 3).map((product) => ({
        id: `product-${product.slug}`,
        label: product.name,
        href: `/producto/${product.slug}`
      }));
      const options = fourOptions([
        ...products.map((product) => `Ver ${product.name}`).slice(0, 3),
        classification.intent === "stock" ? "Consultar otra cantidad" : "Calcular cantidad"
      ]);
      const productActions: AssistantAction[] = [
        ...products.map((product) => ({ label: `Ver ${product.name}`, href: `/producto/${product.slug}` })),
        { label: "Calcular cantidad", message: "Quiero calcular la cantidad de materiales" },
        ...options.map(actionFor)
      ];
      const actions = productActions
        .filter((action, index, allActions) => allActions.findIndex((item) => item.label === action.label) === index)
        .slice(0, 4);
      const state = deriveAssistantState({ intent: classification.intent, message, reply, previous: conversation.state });
      const conversationId = await persistConversation({
        conversationId: conversation.conversationId,
        visitorId: payload.visitorId,
        userId: user?.id ?? null,
        message: payload.message,
        reply,
        intent: classification.intent,
        classification,
        state,
        options,
        sources,
        waitingAdmin: false,
        wasWaitingAdmin: conversation.waitingAdmin,
        skipPersistence: readOnlyLoadTest
      });
      return Response.json({
        intent: classification.intent,
        message: reply,
        conversationId,
        options,
        actions,
        sources,
        handoff_required: false,
        suggested_products: products.map((product) => ({
          name: product.name,
          slug: product.slug,
          price: product.price,
          stock: product.stock,
          unit: product.unit
        }))
      });
    }

    const reply = `No encontré "${query || payload.message}" en el catálogo activo. Probá con marca, tipo, SKU, medida o una palabra más corta. Si vuelve a faltar, puedo dejar el material solicitado en seguimiento para FZAC.`;
    const state = deriveAssistantState({ intent: classification.intent, message, reply, previous: conversation.state });
    state.stage = "PRODUCT_NOT_FOUND";
    state.unresolvedAttempts = conversation.state?.topic === classification.intent
      ? conversation.state.unresolvedAttempts + 1
      : 1;
    const waitingAdmin = state.unresolvedAttempts >= 2;
    const options = fourOptions(["Buscar otro nombre", "Ver categorias", "Ver productos", "Hablar con FZAC"]);
    const conversationId = await persistConversation({
      conversationId: conversation.conversationId,
      visitorId: payload.visitorId,
      userId: user?.id ?? null,
      message: payload.message,
      reply,
      intent: classification.intent,
      classification,
      state,
      options,
      waitingAdmin,
      wasWaitingAdmin: conversation.waitingAdmin,
      skipPersistence: readOnlyLoadTest
    });
    return Response.json({
      intent: "product_not_found",
      message: reply,
      conversationId,
      waitingAdmin,
      options,
      actions: options.map(actionFor),
      handoff_required: waitingAdmin,
      suggested_products: []
    });
  }

  const knowledgeEligible = ![
    "greeting",
    "order_status",
    "account",
    "stock",
    "price",
    "product_search",
    "estimate"
  ].includes(classification.intent);
  const hasSpecificDeliveryContext = classification.intent === "delivery" && Boolean(deliveryDistance(message));
  const knowledge = knowledgeEligible && !criticalEscalation && !hasSpecificDeliveryContext
    ? await retrieveFzacKnowledge(message, classification.intent, conversation.history)
    : null;

  if (knowledge) {
    const traceId = crypto.randomUUID();
    const options = knowledge.actions.map((action) => action.label).slice(0, 4);
    const state = deriveAssistantState({
      intent: classification.intent,
      message,
      reply: knowledge.answer,
      previous: conversation.state
    });
    state.stage = "KNOWLEDGE_ANSWERED";
    state.gathered = { ...state.gathered, knowledgeId: knowledge.id };
    const conversationId = await persistConversation({
      conversationId: conversation.conversationId,
      visitorId: payload.visitorId,
      userId: user?.id ?? null,
      message: payload.message,
      reply: knowledge.answer,
      intent: classification.intent,
      classification,
      state,
      options,
      sources: knowledge.sources,
      knowledgeId: knowledge.id,
      traceId,
      waitingAdmin: false,
      wasWaitingAdmin: conversation.waitingAdmin,
      skipPersistence: readOnlyLoadTest
    });
    return Response.json({
      intent: classification.intent,
      message: knowledge.answer,
      conversationId,
      waitingAdmin: false,
      options,
      actions: knowledge.actions,
      sources: knowledge.sources,
      trace_id: traceId,
      knowledge_id: knowledge.id,
      handoff_required: false,
      suggested_products: []
    });
  }

  const guided = guidedReply(message, classification.intent, conversation.history);
  let reply = guided.message || advisoryReply(message, conversation.history);
  if (classification.intent === "order_status" && user?.id) {
    reply = (await ownOrderStatus(user.id)) ?? reply;
  }
  const state = deriveAssistantState({ intent: classification.intent, message, reply, previous: conversation.state });
  const waitingAdmin = criticalEscalation || state.unresolvedAttempts >= 2;
  if (!criticalEscalation && state.unresolvedAttempts >= 2) {
    reply = `${reply} Como ya intentamos aclararlo dos veces, deje la consulta en seguimiento para que FZAC pueda revisarla si no logras resolverla con estas opciones.`;
    state.lastReply = reply.slice(0, 240);
  }
  const options = fourOptions(guided.options ?? defaultOptions);
  const conversationId = await persistConversation({
    conversationId: conversation.conversationId,
    visitorId: payload.visitorId,
    userId: user?.id ?? null,
    message: payload.message,
    reply,
    intent: classification.intent,
    classification,
    state,
    options,
    waitingAdmin,
    wasWaitingAdmin: conversation.waitingAdmin,
    skipPersistence: readOnlyLoadTest
  });
  return Response.json({
    intent: classification.intent,
    message: reply,
    conversationId,
    waitingAdmin,
    options,
    actions: options.map(actionFor),
    handoff_required: waitingAdmin,
    suggested_products: []
  });
}
