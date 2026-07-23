import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";

const MAX_REPORT_BYTES = 16_384;

function safeReportValue(value: unknown, maxLength = 240) {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\t]/g, " ").slice(0, maxLength);
}

function sanitizedReport(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const envelope = payload as Record<string, unknown>;
  const source = (envelope["csp-report"] ?? envelope.body ?? envelope) as Record<string, unknown>;
  if (!source || typeof source !== "object") return null;

  return {
    effective_directive: safeReportValue(source["effective-directive"] ?? source.effectiveDirective, 80),
    violated_directive: safeReportValue(source["violated-directive"] ?? source.violatedDirective, 120),
    disposition: safeReportValue(source.disposition, 24),
    blocked_url: safeReportValue(source["blocked-uri"] ?? source.blockedURL),
    document_url: safeReportValue(source["document-uri"] ?? source.documentURL)
  };
}

export async function POST(request: Request) {
  const limit = rateLimit(getRequestKey(request, "csp-report"), 30, 60_000);
  if (!limit.ok) {
    return new Response(null, { status: 429, headers: retryAfterHeaders(limit) });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REPORT_BYTES) {
    return new Response(null, { status: 413 });
  }

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_REPORT_BYTES) return new Response(null, { status: 413 });

  try {
    const report = sanitizedReport(JSON.parse(raw));
    if (report && process.env.NODE_ENV === "production") {
      console.warn("[security.csp-report]", report);
    }
  } catch {
    return new Response(null, { status: 400 });
  }

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
