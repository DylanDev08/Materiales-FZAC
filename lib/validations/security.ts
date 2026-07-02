const SQL_META = /('|--|\/\*|\*\/|;|\\x00|\b(select|insert|update|delete|drop|alter|truncate|grant|revoke|union|exec|execute)\b)/i;

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

export function assertSafeText(value: string | undefined | null, label = "campo") {
  if (hasSqlMeta(value)) {
    throw new Error(`El ${label} contiene caracteres no permitidos.`);
  }
}
