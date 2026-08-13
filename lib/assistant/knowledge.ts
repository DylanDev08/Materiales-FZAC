import "server-only";

import {
  ASSISTANT_INTENTS,
  type AssistantAction,
  type AssistantHistoryItem,
  type AssistantIntent,
  type AssistantSource
} from "@/lib/assistant/contracts";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type KnowledgeEntry = {
  id: string;
  title: string;
  href: string;
  intents: AssistantIntent[];
  keywords: string[];
  phrases: string[];
  answers: string[];
  actions: AssistantAction[];
  updatedAt?: string;
  version?: number;
};

export type FzacKnowledgeMatch = {
  id: string;
  answer: string;
  score: number;
  sources: AssistantSource[];
  actions: AssistantAction[];
  updatedAt?: string;
  version?: number;
};

const STOP_WORDS = new Set([
  "a", "al", "algo", "como", "con", "cual", "de", "del", "el", "en", "es", "esta", "hacer", "la", "las",
  "lo", "los", "me", "mi", "para", "por", "puedo", "que", "se", "si", "su", "un", "una", "y"
]);

const entries: KnowledgeEntry[] = [
  {
    id: "buying-process",
    title: "Cómo comprar",
    href: "/como-comprar",
    intents: ["product_search", "store_policy", "fallback"],
    keywords: ["comprar", "compra", "proceso", "pasos", "carrito", "checkout"],
    phrases: ["como comprar", "como hago una compra", "pasos para comprar"],
    answers: [
      "La compra se completa en cuatro etapas: elegís los productos, confirmás tus datos y modalidad de entrega, FZAC valida stock y precios, y finalmente pagás online o generás el pedido para coordinar. Podés seguir cada pedido desde Mi cuenta.",
      "Para comprar, agregá materiales al carrito, revisá cantidades y unidad de venta, completá tus datos y elegí entrega y pago. El backend vuelve a validar precio y stock antes de crear el pedido."
    ],
    actions: [
      { label: "Ver productos", href: "/productos" },
      { label: "Cómo comprar", href: "/como-comprar" },
      { label: "Ver carrito", href: "/carrito" }
    ]
  },
  {
    id: "payment-overview",
    title: "Medios de pago",
    href: "/medios-de-pago",
    intents: ["payment"],
    keywords: ["pago", "pagar", "medio", "mercado", "tarjeta", "transferencia", "whatsapp"],
    phrases: ["medios de pago", "formas de pago", "como puedo pagar", "como pago"],
    answers: [
      "FZAC ofrece pago online con Mercado Pago, pedido pendiente por transferencia y coordinación por WhatsApp. Solo Mercado Pago inicia una operación con el proveedor; transferencia y WhatsApp no abren Mercado Pago.",
      "Podés pagar online mediante Mercado Pago o generar un pedido para transferir o coordinar por WhatsApp. El stock no se descuenta por una operación pendiente o rechazada."
    ],
    actions: [
      { label: "Ver medios de pago", href: "/medios-de-pago" },
      { label: "Ir al checkout", href: "/checkout" },
      { label: "Seguridad del pago", message: "¿FZAC guarda los datos de mi tarjeta?" }
    ]
  },
  {
    id: "bank-transfer",
    title: "Transferencia FZAC",
    href: "/medios-de-pago",
    intents: ["payment"],
    keywords: ["transferencia", "transferir", "alias", "cbu", "comprobante", "bancaria"],
    phrases: [
      "pagar por transferencia",
      "pagar con transferencia",
      "como pago por transferencia",
      "como pagar por transferencia",
      "pago por transferencia",
      "datos para transferir",
      "enviar comprobante"
    ],
    answers: [
      "Al elegir transferencia, FZAC genera un pedido pendiente y no te redirige a Mercado Pago. Administración revisa el pedido y te comunica los datos para transferir; la acreditación y el stock se confirman después de validar el pago.",
      "La transferencia funciona como pedido pendiente: primero se crea la orden, luego FZAC informa los datos bancarios y valida el comprobante. No compartas comprobantes ni datos bancarios dentro del chatbot."
    ],
    actions: [
      { label: "Generar pedido", href: "/checkout" },
      { label: "Ver medios de pago", href: "/medios-de-pago" },
      { label: "Consultar pedido", href: "/cuenta/pedidos" }
    ]
  },
  {
    id: "card-security",
    title: "Seguridad de pagos",
    href: "/medios-de-pago",
    intents: ["payment"],
    keywords: ["tarjeta", "cvv", "numero", "seguridad", "guardar", "datos", "brick"],
    phrases: ["guardan mi tarjeta", "datos de tarjeta", "pago seguro", "guardar cvv"],
    answers: [
      "FZAC no guarda número de tarjeta, vencimiento ni CVV. Los datos se procesan mediante componentes oficiales del proveedor de pagos y la confirmación final se verifica desde el servidor y el webhook.",
      "Los datos sensibles de tarjeta no pasan a la base de FZAC. El proveedor tokeniza el pago y FZAC solo conserva referencias y estados necesarios para administrar la compra."
    ],
    actions: [
      { label: "Ver seguridad de pagos", href: "/medios-de-pago" },
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Ir al checkout", href: "/checkout" }
    ]
  },
  {
    id: "delivery-policy",
    title: "Envíos y retiros",
    href: "/envios-y-retiros",
    intents: ["delivery"],
    keywords: ["envio", "entrega", "flete", "domicilio", "direccion", "distancia", "zona"],
    phrases: ["como funciona el envio", "hacen envios", "envio a domicilio", "costo de envio"],
    answers: [
      "Para envío a domicilio se necesita una dirección completa. La modalidad y el costo se informan antes de confirmar; si no hay una cotización automática disponible, el pedido queda para coordinar y FZAC no inventa un valor de flete.",
      "Los envíos se revisan según dirección, distancia y características del pedido. Cargá calle, número, ciudad y teléfono; cuando la cotización no está automatizada, FZAC confirma el costo antes de cerrar la operación."
    ],
    actions: [
      { label: "Envíos y retiros", href: "/envios-y-retiros" },
      { label: "Cargar dirección", href: "/cuenta/direcciones" },
      { label: "Prefiero retirar", message: "Quiero retirar mi pedido" }
    ]
  },
  {
    id: "pickup-policy",
    title: "Retiro coordinado",
    href: "/envios-y-retiros",
    intents: ["delivery"],
    keywords: ["retiro", "retirar", "buscar", "local", "deposito", "dirección"],
    phrases: ["retiro en el local", "pasar a buscar", "retirar pedido", "retiro coordinado"],
    answers: [
      "El retiro es coordinado: no exige dirección de entrega ni suma flete. FZAC valida stock, prepara el pedido y avisa cuándo está listo; la persona autorizada debe presentar los datos solicitados para retirarlo.",
      "Si elegís retiro, completás solo tus datos de contacto y el medio de pago. Esperá la confirmación de preparación antes de acercarte, porque una orden creada todavía puede estar pendiente de stock o pago."
    ],
    actions: [
      { label: "Elegir retiro", href: "/checkout" },
      { label: "Ver mi pedido", href: "/cuenta/pedidos" },
      { label: "Envíos y retiros", href: "/envios-y-retiros" }
    ]
  },
  {
    id: "returns-policy",
    title: "Cambios y devoluciones",
    href: "/cambios-y-devoluciones",
    intents: ["returns"],
    keywords: ["devolucion", "devolver", "cambio", "garantia", "dañado", "roto", "reembolso"],
    phrases: ["quiero devolver", "solicitar la devolucion", "devolucion del pedido", "producto dañado", "hacer un cambio", "pedir reembolso"],
    answers: [
      "Para solicitar revisión, conservá el comprobante e informá pedido, producto, motivo y estado de la mercadería. FZAC registra el caso y revisa uso, embalaje, entrega y posibles excepciones antes de resolver cambio o reembolso.",
      "Los cambios y devoluciones se gestionan mediante una solicitud formal. Tener número de pedido, comprobante y fotos facilita la revisión; el reembolso, si corresponde, se procesa por el medio original."
    ],
    actions: [
      { label: "Solicitar revisión", href: "/arrepentimiento" },
      { label: "Ver condiciones", href: "/cambios-y-devoluciones" },
      { label: "Mis solicitudes", href: "/cuenta/solicitudes" }
    ]
  },
  {
    id: "withdrawal-right",
    title: "Botón de arrepentimiento",
    href: "/arrepentimiento",
    intents: ["returns"],
    keywords: ["arrepentimiento", "revocar", "revocacion", "cancelar", "diez", "dias"],
    phrases: ["boton de arrepentimiento", "derecho de arrepentimiento", "cancelar compra online"],
    answers: [
      "El Botón de arrepentimiento permite iniciar una solicitud sobre una compra a distancia sin necesidad de ingresar al panel. La política vigente informa un plazo de diez días y FZAC entrega una constancia con número de trámite.",
      "Podés iniciar el arrepentimiento desde el formulario público. Indicá tus datos y el pedido; la solicitud queda registrada para revisión y seguimiento, sin exigir condiciones adicionales para comenzar el trámite."
    ],
    actions: [
      { label: "Iniciar solicitud", href: "/arrepentimiento" },
      { label: "Leer condiciones", href: "/cambios-y-devoluciones" },
      { label: "Ver términos", href: "/terminos" }
    ]
  },
  {
    id: "privacy-policy",
    title: "Política de privacidad",
    href: "/privacidad",
    intents: ["store_policy", "fallback"],
    keywords: ["privacidad", "datos", "personales", "eliminar", "cuenta", "informacion", "cookies"],
    phrases: ["politica de privacidad", "eliminar mis datos", "que datos guardan", "datos personales"],
    answers: [
      "FZAC utiliza datos de identidad, contacto, cuenta y compra para operar pedidos, pagos, entregas y atención. No guarda datos de tarjeta. Podés consultar la política para conocer conservación, proveedores y cómo solicitar acceso, rectificación o supresión.",
      "La información personal se usa para autenticación, pedidos, pagos, entrega y soporte. El acceso administrativo está restringido y los derechos sobre tus datos se gestionan por los canales indicados en la Política de privacidad."
    ],
    actions: [
      { label: "Política de privacidad", href: "/privacidad" },
      { label: "Ajustes de cuenta", href: "/cuenta/ajustes" },
      { label: "Contacto FZAC", href: "/contacto" }
    ]
  },
  {
    id: "terms-policy",
    title: "Términos y condiciones",
    href: "/terminos",
    intents: ["store_policy", "fallback"],
    keywords: ["terminos", "condiciones", "legal", "politica", "garantia", "consumidor"],
    phrases: ["terminos y condiciones", "condiciones de compra", "defensa del consumidor"],
    answers: [
      "Los Términos FZAC explican identificación del proveedor, catálogo, disponibilidad, pagos, entrega, retiro, arrepentimiento, garantías, reembolsos y datos personales. La versión completa está disponible antes de confirmar la compra.",
      "Las condiciones de compra reúnen las reglas vigentes sobre precio, stock, pago, entrega, garantía y derechos del consumidor. Para una decisión legal o un reclamo concreto, revisá siempre el texto completo."
    ],
    actions: [
      { label: "Ver términos", href: "/terminos" },
      { label: "Cambios y devoluciones", href: "/cambios-y-devoluciones" },
      { label: "Política de privacidad", href: "/privacidad" }
    ]
  }
];

let databaseCache: { expiresAt: number; entries: KnowledgeEntry[] | null } | null = null;
const DATABASE_CACHE_TTL_MS = 30_000;

function isInternalHref(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value.length <= 180;
}

function normalizeDatabaseActions(value: unknown, fallbackHref: string): AssistantAction[] {
  if (!Array.isArray(value)) return [{ label: "Ver información", href: fallbackHref }];
  const actions = value.flatMap((item): AssistantAction[] => {
    if (!item || typeof item !== "object") return [];
    const action = item as Record<string, unknown>;
    if (typeof action.label !== "string" || action.label.length < 2 || action.label.length > 80) return [];
    if (isInternalHref(action.href)) return [{ label: action.label, href: action.href }];
    if (typeof action.message === "string" && action.message.length >= 2 && action.message.length <= 180) {
      return [{ label: action.label, message: action.message }];
    }
    return [];
  });
  return actions.length ? actions.slice(0, 4) : [{ label: "Ver información", href: fallbackHref }];
}

function mapDatabaseEntry(row: Record<string, unknown>): KnowledgeEntry | null {
  const intent = String(row.intent ?? "fallback") as AssistantIntent;
  const href = isInternalHref(row.source_href) ? row.source_href : null;
  if (!ASSISTANT_INTENTS.includes(intent) || !href) return null;
  const answer = String(row.answer ?? "").trim();
  if (answer.length < 20 || answer.length > 1200) return null;
  const alternateAnswer = String(row.alternate_answer ?? "").trim();

  return {
    id: String(row.slug),
    title: String(row.source_label ?? row.title ?? "Información FZAC").slice(0, 100),
    href,
    intents: [intent],
    keywords: Array.isArray(row.keywords) ? row.keywords.map(String).slice(0, 30) : [],
    phrases: Array.isArray(row.phrases) ? row.phrases.map(String).slice(0, 20) : [],
    answers: [answer, alternateAnswer].filter((value) => value.length >= 20),
    actions: normalizeDatabaseActions(row.actions, href),
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
    version: Number.isInteger(Number(row.version)) ? Number(row.version) : undefined
  };
}

async function loadDatabaseEntries(): Promise<KnowledgeEntry[] | null> {
  const now = Date.now();
  if (databaseCache && databaseCache.expiresAt > now) return databaseCache.entries;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const query = Promise.resolve(
    supabase
      .from("assistant_knowledge")
      .select("slug,title,topic,intent,keywords,phrases,answer,alternate_answer,source_label,source_href,actions,version,updated_at")
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(100)
  );
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), 1_200);
  });
  const result = await Promise.race([query, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  if (!result || result.error) {
    databaseCache = { expiresAt: now + 10_000, entries: null };
    return null;
  }

  const mapped = (result.data ?? [])
    .map((row) => mapDatabaseEntry(row as Record<string, unknown>))
    .filter((entry): entry is KnowledgeEntry => Boolean(entry));
  databaseCache = { expiresAt: now + DATABASE_CACHE_TTL_MS, entries: mapped };
  return mapped;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}

function scoreEntry(entry: KnowledgeEntry, message: string, intent: AssistantIntent) {
  const normalizedMessage = normalize(message);
  const messageTokens = tokens(message);
  let score = entry.intents.includes(intent) ? 2 : 0;

  for (const phrase of entry.phrases) {
    if (normalizedMessage.includes(normalize(phrase))) score += 8;
  }
  for (const keyword of entry.keywords) {
    if (messageTokens.has(normalize(keyword))) score += 2;
  }
  for (const titleToken of tokens(entry.title)) {
    if (messageTokens.has(titleToken)) score += 1;
  }
  return score;
}

function chooseAnswer(entry: KnowledgeEntry, history: AssistantHistoryItem[]) {
  const recentReplies = new Set(
    history.filter((item) => item.role === "assistant").slice(-4).map((item) => item.content.trim())
  );
  return entry.answers.find((answer) => !recentReplies.has(answer)) ?? entry.answers[history.length % entry.answers.length];
}

export async function retrieveFzacKnowledge(
  message: string,
  intent: AssistantIntent,
  history: AssistantHistoryItem[] = []
): Promise<FzacKnowledgeMatch | null> {
  const databaseEntries = await loadDatabaseEntries();
  const availableEntries = databaseEntries ?? entries;
  const ranked = availableEntries
    .map((entry) => ({ entry, score: scoreEntry(entry, message, intent) }))
    .filter((candidate) => candidate.score >= 6)
    .sort((left, right) => right.score - left.score || left.entry.id.localeCompare(right.entry.id));
  const best = ranked[0];
  if (!best) return null;

  return {
    id: best.entry.id,
    answer: chooseAnswer(best.entry, history),
    score: best.score,
    sources: [{ id: best.entry.id, label: best.entry.title, href: best.entry.href, updatedAt: best.entry.updatedAt }],
    actions: best.entry.actions.slice(0, 4),
    updatedAt: best.entry.updatedAt,
    version: best.entry.version
  };
}

export function invalidateFzacKnowledgeCache() {
  databaseCache = null;
}

export function listFzacKnowledgeEntries() {
  return entries.map(({ id, title, href }) => ({ id, title, href }));
}
