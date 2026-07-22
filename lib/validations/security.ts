const SQL_META = /('|--|\/\*|\*\/|;|\\x00|\b(select|insert|update|delete|drop|alter|truncate|grant|revoke|union|exec|execute)\b)/i;
const HTML_OR_SCRIPT_META = /(<\/?[a-z][\s\S]*>|javascript:|data:text\/html|on\w+\s*=)/i;
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const SAFE_NOTE_CHARS = /^[\p{L}\p{M}\p{N}\s.,:;!?¡¿()/#°º+\-'"@%&\n\r]*$/u;

export function sanitizeSearchTerm(value: string | undefined | null, maxLength = 80) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[(),%_*"']/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function hasSqlMeta(value: string | undefined | null) {
  return SQL_META.test(String(value ?? ""));
}

export function hasUnsafeUserContent(value: string | undefined | null) {
  const text = String(value ?? "");
  return SQL_META.test(text) || HTML_OR_SCRIPT_META.test(text) || CONTROL_CHARS.test(text);
}

export function assertSafeText(value: string | undefined | null, label = "campo") {
  if (hasUnsafeUserContent(value)) {
    throw new Error(`El ${label} contiene caracteres no permitidos.`);
  }
}

export function normalizePhoneDigits(value: string | undefined | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export function limitPhoneInput(value: string) {
  let digitCount = 0;
  return value
    .replace(/[^\d+().\s-]/g, "")
    .split("")
    .filter((character, index) => {
      if (character === "+") return index === 0;
      if (!/\d/.test(character)) return true;
      digitCount += 1;
      return digitCount <= 13;
    })
    .join("")
    .slice(0, 18);
}

export function isValidArgentinePhone(value: string | undefined | null) {
  const raw = String(value ?? "").trim();
  const digits = normalizePhoneDigits(raw);
  if (!raw || !/^\+?[0-9\s().-]+$/.test(raw)) return false;
  if (digits.length === 10) return true;
  if (digits.length === 12 && digits.startsWith("54")) return true;
  if (digits.length === 13 && digits.startsWith("549")) return true;
  return false;
}

export function normalizeUserNote(value: string | undefined | null, maxLength = 500) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function isSafeUserNote(value: string | undefined | null) {
  const note = String(value ?? "");
  return !hasUnsafeUserContent(note) && SAFE_NOTE_CHARS.test(note);
}
