import "server-only";

type GroundedLanguageInput = {
  question: string;
  draft: string;
  facts?: string[];
};

type LanguageModelResult = {
  text: string;
  used: boolean;
  reason: "DISABLED" | "NOT_CONFIGURED" | "REJECTED" | "FAILED" | "APPLIED";
};

function enabled() {
  return process.env.ASSISTANT_LLM_ENABLED?.trim().toLowerCase() === "true";
}

function allowedHosts() {
  return new Set(
    String(process.env.ASSISTANT_LLM_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

function redactUserText(value: string) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email omitido]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[identificador omitido]")
    .replace(/\b(?:\d[ -]*?){8,19}\b/g, "[numero omitido]")
    .slice(0, 500);
}

function numericTokens(value: string) {
  return new Set(value.match(/\b\d+(?:[.,]\d+)?\b/g) ?? []);
}

function urlTokens(value: string) {
  return new Set(value.match(/https?:\/\/[^\s)]+/gi) ?? []);
}

function outputIsGrounded(output: string, source: string) {
  if (!output.trim() || output.length > 1_400) return false;
  const allowedNumbers = numericTokens(source);
  const allowedUrls = urlTokens(source);
  return [...numericTokens(output)].every((token) => allowedNumbers.has(token))
    && [...urlTokens(output)].every((url) => allowedUrls.has(url));
}

function extractText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const first = choices[0];
  if (!first || typeof first !== "object") return null;
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return null;
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content.trim() : null;
}

export async function refineGroundedAssistantAnswer(input: GroundedLanguageInput): Promise<LanguageModelResult> {
  if (!enabled()) return { text: input.draft, used: false, reason: "DISABLED" };

  const endpointValue = process.env.ASSISTANT_LLM_ENDPOINT?.trim() ?? "";
  const apiKey = process.env.ASSISTANT_LLM_API_KEY?.trim() ?? "";
  const model = process.env.ASSISTANT_LLM_MODEL?.trim() ?? "";
  if (!endpointValue || !apiKey || !model) return { text: input.draft, used: false, reason: "NOT_CONFIGURED" };

  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    return { text: input.draft, used: false, reason: "NOT_CONFIGURED" };
  }
  if (endpoint.protocol !== "https:" || !allowedHosts().has(endpoint.hostname.toLowerCase())) {
    return { text: input.draft, used: false, reason: "NOT_CONFIGURED" };
  }

  const facts = (input.facts ?? []).map((fact) => fact.slice(0, 500)).slice(0, 8);
  const groundedSource = [input.draft, ...facts].join("\n");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 320,
        messages: [
          {
            role: "system",
            content: "Sos el asistente de Materiales FZAC. Reescribi con tono claro y argentino usando solamente los hechos entregados. No agregues precios, stock, medidas, enlaces, politicas ni equivalencias. No prometas disponibilidad. Si falta informacion, conserva la aclaracion del borrador."
          },
          {
            role: "user",
            content: `Pregunta saneada: ${redactUserText(input.question)}\n\nHechos autorizados:\n${groundedSource}\n\nRespuesta base:\n${input.draft}`
          }
        ]
      }),
      cache: "no-store",
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) return { text: input.draft, used: false, reason: "FAILED" };
    const text = extractText(await response.json());
    if (!text || !outputIsGrounded(text, groundedSource)) {
      return { text: input.draft, used: false, reason: "REJECTED" };
    }
    return { text, used: true, reason: "APPLIED" };
  } catch {
    return { text: input.draft, used: false, reason: "FAILED" };
  } finally {
    clearTimeout(timeout);
  }
}
