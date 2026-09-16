import "server-only";

import { randomUUID } from "node:crypto";

type LogLevel = "info" | "warn" | "error";
type LogValue = string | number | boolean | null | undefined;

const SENSITIVE_KEY = /password|authorization|token|secret|cookie|card|raw|payload|service.?role|refresh/i;
const CORRELATION_ID = /^[a-zA-Z0-9._:-]{8,96}$/;

export function getCorrelationId(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim() ?? "";
  return CORRELATION_ID.test(incoming) ? incoming : randomUUID();
}

function safeFields(fields: Record<string, LogValue>) {
  const safe: Record<string, Exclude<LogValue, undefined>> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SENSITIVE_KEY.test(key) || value === undefined) continue;
    safe[key] = typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").slice(0, 180) : value;
  }
  return safe;
}

export function logEvent(level: LogLevel, event: string, fields: Record<string, LogValue> = {}) {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event: event.replace(/[^a-z0-9._-]/gi, "_").slice(0, 80),
    ...safeFields(fields)
  });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.info(entry);
}

export function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return "UNKNOWN_ERROR";
  const candidate = error as { code?: unknown; name?: unknown };
  const value = typeof candidate.code === "string" ? candidate.code : typeof candidate.name === "string" ? candidate.name : "UNKNOWN_ERROR";
  return value.replace(/[^A-Z0-9_-]/gi, "_").slice(0, 80).toUpperCase();
}
