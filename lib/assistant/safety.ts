export type AssistantSafetyDecision = "ALLOW" | "REDACT" | "BLOCK";

export type AssistantSafetyReason =
  | "SAFE"
  | "PERSONAL_DATA_REDACTED"
  | "PAYMENT_DATA"
  | "SECRET_EXFILTRATION"
  | "PROMPT_INJECTION"
  | "CODE_INJECTION"
  | "CROSS_USER_DATA";

export type AssistantSafetyAssessment = {
  decision: AssistantSafetyDecision;
  reason: AssistantSafetyReason;
  safeText: string;
  persistenceText: string;
  redacted: boolean;
};

const EMAIL = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi;
const PHONE_OR_DOCUMENT = /\+?\d(?:[\s().-]*\d){7,12}/g;
const EXPLICIT_SECRET = /\b(?:sk|sbp|re|rnd|pat|ghp|xox[baprs]|app_usr)[-_][a-z0-9_-]{12,}\b/gi;
const AUTHORIZATION_SECRET = /\b(?:bearer|authorization)\s+[a-z0-9._~+\/-]{12,}/gi;
const PASSWORD_VALUE = /\b(?:password|contrasena|contraseña|clave)\s*[:=]\s*\S+/gi;
const CVV_VALUE = /\b(?:cvv|cvc|codigo de seguridad|código de seguridad)\s*[:=]?\s*\d{3,4}\b/gi;
const EXPIRY_VALUE = /\b(?:vencimiento|vence|expiry)\s*[:=]?\s*(?:0[1-9]|1[0-2])\s*[\/-]\s*\d{2,4}\b/gi;
const HTML_EXECUTION = /<\s*(?:script|iframe|object|embed|svg)\b|javascript\s*:|on(?:error|load|click)\s*=|data\s*:\s*text\/html/i;
const SQL_ATTACK = /\b(?:union\s+select|drop\s+table|truncate\s+table|information_schema|pg_catalog|sleep\s*\(|benchmark\s*\()|(?:--|\/\*)\s*(?:select|drop|union)/i;

const PROMPT_INJECTION_PATTERNS = [
  /\bignora(?:r)?\s+(?:todas?\s+)?(?:las?\s+)?instrucciones?\b/i,
  /\bolvida(?:r)?\s+(?:todas?\s+)?(?:las?\s+)?instrucciones?\b/i,
  /\b(?:system|developer)\s+prompt\b/i,
  /\bprompt\s+(?:del\s+)?sistema\b/i,
  /\bmodo\s+(?:desarrollador|developer|jailbreak)\b/i,
  /\brepite\s+(?:el\s+)?mensaje\s+(?:del\s+)?sistema\b/i,
  /\bactua\s+como\s+si\s+no\s+tuvieras\s+reglas\b/i
];

const SECRET_EXFILTRATION_PATTERNS = [
  /\b(?:mostra|mostrar|revela|revelar|dame|imprimi|imprimir|lista|listar)\b[\s\S]{0,80}\b(?:\.env|variables? de entorno|api keys?|tokens?|secretos?|service[_ -]?role|access[_ -]?token)\b/i,
  /\b(?:lee|leer|accede|acceder)\b[\s\S]{0,60}\b(?:\.env|credenciales?|secretos?|configuracion interna)\b/i,
  /\b(?:supabase_service_role_key|mercadopago_access_token|resend_api_key)\b/i
];

const CROSS_USER_PATTERNS = [
  /\b(?:datos|pedidos|pagos|direcciones|emails?|telefonos?)\s+de\s+(?:otros?|todos?)(?:\s+los)?\s+(?:clientes|usuarios)\b/i,
  /\b(?:lista|listado|base)\s+de\s+(?:clientes|usuarios|emails?|telefonos?)\b/i,
  /\bpedido\s+de\s+otro\s+(?:cliente|usuario)\b/i
];

function normalize(value: string) {
  return value.normalize("NFKC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ").trim();
}

function matches(pattern: RegExp, value: string) {
  pattern.lastIndex = 0;
  const result = pattern.test(value);
  pattern.lastIndex = 0;
  return result;
}

function luhn(candidate: string) {
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(\d)\1+$/.test(digits)) return false;
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
}

function containsPaymentData(value: string) {
  const candidates = value.match(/(?:\d[ -]?){13,19}/g) ?? [];
  return candidates.some(luhn) || matches(CVV_VALUE, value) || matches(EXPIRY_VALUE, value);
}

function containsExplicitSecret(value: string) {
  return matches(EXPLICIT_SECRET, value) || matches(AUTHORIZATION_SECRET, value) || matches(PASSWORD_VALUE, value);
}

export function redactAssistantSensitiveText(value: string, maxLength = 500) {
  const normalized = normalize(value).slice(0, maxLength);
  return normalized
    .replace(EXPLICIT_SECRET, "[credencial omitida]")
    .replace(AUTHORIZATION_SECRET, "[credencial omitida]")
    .replace(PASSWORD_VALUE, "[contraseña omitida]")
    .replace(CVV_VALUE, "[dato de tarjeta omitido]")
    .replace(EXPIRY_VALUE, "[dato de tarjeta omitido]")
    .replace(/(?:\d[ -]?){13,19}/g, (candidate) => luhn(candidate) ? "[tarjeta omitida]" : candidate)
    .replace(EMAIL, "[email omitido]")
    .replace(UUID, "[referencia omitida]")
    .replace(PHONE_OR_DOCUMENT, "[dato personal omitido]")
    .replace(/\s+/g, " ")
    .trim();
}

export function assessAssistantInput(value: string): AssistantSafetyAssessment {
  const normalized = normalize(value).slice(0, 500);
  const persistenceText = redactAssistantSensitiveText(normalized);

  if (HTML_EXECUTION.test(normalized) || SQL_ATTACK.test(normalized)) {
    return { decision: "BLOCK", reason: "CODE_INJECTION", safeText: persistenceText, persistenceText: "[consulta bloqueada: contenido ejecutable]", redacted: true };
  }
  if (PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { decision: "BLOCK", reason: "PROMPT_INJECTION", safeText: persistenceText, persistenceText: "[consulta bloqueada: intento de alterar el asistente]", redacted: true };
  }
  if (SECRET_EXFILTRATION_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { decision: "BLOCK", reason: "SECRET_EXFILTRATION", safeText: persistenceText, persistenceText: "[consulta bloqueada: solicitud de información interna]", redacted: true };
  }
  if (CROSS_USER_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { decision: "BLOCK", reason: "CROSS_USER_DATA", safeText: persistenceText, persistenceText: "[consulta bloqueada: datos de terceros]", redacted: true };
  }
  if (containsPaymentData(normalized) || containsExplicitSecret(normalized)) {
    return { decision: "REDACT", reason: "PAYMENT_DATA", safeText: persistenceText, persistenceText: "[dato sensible omitido por seguridad]", redacted: true };
  }

  const redacted = persistenceText !== normalized;
  return {
    decision: "ALLOW",
    reason: redacted ? "PERSONAL_DATA_REDACTED" : "SAFE",
    safeText: persistenceText,
    persistenceText,
    redacted
  };
}

export function assistantSafetyReply(reason: AssistantSafetyReason) {
  if (reason === "PAYMENT_DATA") {
    return "Por seguridad eliminé los datos sensibles del mensaje. No compartas números de tarjeta, CVV, vencimiento, contraseñas ni tokens. Podés consultar cómo pagar sin incluir esos datos.";
  }
  if (reason === "CROSS_USER_DATA") {
    return "No puedo consultar ni revelar información de otros clientes. Con una sesión iniciada solo puedo orientar sobre los pedidos asociados a tu propia cuenta.";
  }
  return "No puedo revelar instrucciones internas, credenciales, configuración privada ni ejecutar código enviado por el chat. Sí puedo ayudarte con productos, stock, cantidades, pagos, entregas o tus propios pedidos.";
}
