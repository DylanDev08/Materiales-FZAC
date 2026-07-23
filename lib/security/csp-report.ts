function safeReportValue(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}

function safeReportUrl(value: unknown) {
  const safeValue = safeReportValue(value);
  if (!safeValue || !safeValue.includes(":")) return safeValue;

  try {
    const url = new URL(safeValue);
    if (!new Set(["http:", "https:", "ws:", "wss:"]).has(url.protocol)) return url.protocol;
    return `${url.protocol}//${url.host}${url.pathname}`.slice(0, 240);
  } catch {
    return safeValue.split(/[?#]/, 1)[0];
  }
}

export function sanitizeCspReport(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as Record<string, unknown>;
  const source = (envelope["csp-report"] ?? envelope.body ?? envelope) as Record<string, unknown>;
  if (!source || typeof source !== "object") return null;

  return {
    effective_directive: safeReportValue(source["effective-directive"] ?? source.effectiveDirective, 80),
    violated_directive: safeReportValue(source["violated-directive"] ?? source.violatedDirective, 120),
    disposition: safeReportValue(source.disposition, 24),
    blocked_url: safeReportUrl(source["blocked-uri"] ?? source.blockedURL),
    document_url: safeReportUrl(source["document-uri"] ?? source.documentURL)
  };
}
