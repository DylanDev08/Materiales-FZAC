import "server-only";

export type AssistantIntent =
  | "greeting"
  | "delivery"
  | "payment"
  | "stock"
  | "estimate"
  | "order_status"
  | "returns"
  | "human"
  | "product_search"
  | "fallback";

type TrainingSample = {
  intent: AssistantIntent;
  text: string;
};

type IntentModel = {
  vocabulary: Set<string>;
  intentDocs: Map<AssistantIntent, number>;
  tokenCounts: Map<AssistantIntent, Map<string, number>>;
  totalTokens: Map<AssistantIntent, number>;
  totalDocs: number;
};

const trainingData: TrainingSample[] = [
  { intent: "greeting", text: "hola buenas buen dia buenas tardes buenas noches" },
  { intent: "greeting", text: "hola necesito ayuda como funciona la tienda" },
  { intent: "delivery", text: "envio entrega domicilio flete zona distancia kilometros km" },
  { intent: "delivery", text: "estoy dentro de rosario hasta 30 km mas de 50 km retiro cargar direccion" },
  { intent: "delivery", text: "coordinar envio cotizar flete localidad calle domicilio obra" },
  { intent: "payment", text: "pago tarjeta cuotas transferencia comprobante abonar pagar checkout mercado pago" },
  { intent: "payment", text: "como pago medios de pago pago seguro debito credito dni cuit" },
  { intent: "payment", text: "pagar online pagar con tarjeta pagar con mercado pago pago pendiente rechazado" },
  { intent: "stock", text: "stock disponible cantidad faltante reposicion unidades disponibles" },
  { intent: "stock", text: "no hay stock quiero bajar cantidad equivalente reemplazo" },
  { intent: "estimate", text: "calcular presupuesto metros m2 obra construir reparar materiales necesito" },
  { intent: "estimate", text: "cuanto necesito para pintar levantar pared hacer revoque placas" },
  { intent: "order_status", text: "pedido orden estado comprobante factura seguimiento compra" },
  { intent: "order_status", text: "donde veo mi pedido ya pague numero de orden" },
  { intent: "returns", text: "devolucion cambio garantia devolver producto roto error" },
  { intent: "human", text: "asesor humano persona vendedor llamar whatsapp contacto" },
  { intent: "product_search", text: "cemento cal arena ladrillo placa durlock pintura latex membrana canilla cable" },
  { intent: "product_search", text: "buscar producto comprar material precio catalogo oferta marca sku" },
  { intent: "fallback", text: "consulta duda ayuda informacion general no se que elegir" }
];

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

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function tokenize(value: string) {
  return normalize(value)
    .replace(/[^a-z0-9+\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function trainIntentModel(samples: TrainingSample[]): IntentModel {
  const vocabulary = new Set<string>();
  const intentDocs = new Map<AssistantIntent, number>();
  const tokenCounts = new Map<AssistantIntent, Map<string, number>>();
  const totalTokens = new Map<AssistantIntent, number>();

  samples.forEach((sample) => {
    const tokens = tokenize(sample.text);
    intentDocs.set(sample.intent, (intentDocs.get(sample.intent) ?? 0) + 1);
    if (!tokenCounts.has(sample.intent)) tokenCounts.set(sample.intent, new Map());

    const counts = tokenCounts.get(sample.intent)!;
    tokens.forEach((token) => {
      vocabulary.add(token);
      counts.set(token, (counts.get(token) ?? 0) + 1);
      totalTokens.set(sample.intent, (totalTokens.get(sample.intent) ?? 0) + 1);
    });
  });

  return { vocabulary, intentDocs, tokenCounts, totalTokens, totalDocs: samples.length };
}

const model = trainIntentModel(trainingData);

export function classifyAssistantIntent(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
) {
  const userContext = history
    .filter((item) => item.role === "user")
    .slice(-3)
    .map((item) => item.content);
  const context = [...userContext, message, message].join(" ");
  const tokens = tokenize(context);
  const intents = Array.from(model.intentDocs.keys());
  const vocabularySize = Math.max(model.vocabulary.size, 1);

  const scores = intents.map((intent) => {
    const prior = (model.intentDocs.get(intent) ?? 0) / model.totalDocs;
    const counts = model.tokenCounts.get(intent) ?? new Map<string, number>();
    const total = model.totalTokens.get(intent) ?? 0;
    const score = tokens.reduce((sum, token) => {
      const likelihood = ((counts.get(token) ?? 0) + 1) / (total + vocabularySize);
      return sum + Math.log(likelihood);
    }, Math.log(prior || 1 / model.totalDocs));

    return { intent, score };
  });

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0] ?? { intent: "fallback" as AssistantIntent, score: 0 };
  const runnerUp = scores[1]?.score ?? best.score - 1;
  const confidence = 1 / (1 + Math.exp(-(best.score - runnerUp)));

  return {
    intent: confidence < 0.52 ? "fallback" : best.intent,
    confidence,
    tokens
  };
}
