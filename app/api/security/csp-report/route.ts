import { getRequestKey, rateLimit, retryAfterHeaders } from "@/lib/utils/rate-limit";
import { sanitizeCspReport } from "@/lib/security/csp-report";

const MAX_REPORT_BYTES = 16_384;

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
    const report = sanitizeCspReport(JSON.parse(raw));
    if (report && process.env.NODE_ENV === "production") {
      console.warn(`[security.csp-report] ${JSON.stringify(report)}`);
    }
  } catch {
    return new Response(null, { status: 400 });
  }

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
