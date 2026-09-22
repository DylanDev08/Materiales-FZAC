import "server-only";

import { randomUUID } from "node:crypto";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{8,80}$/;

function requestIdFrom(request: Request) {
  const incoming = request.headers.get("x-request-id")?.trim() ?? "";
  return REQUEST_ID_PATTERN.test(incoming) ? incoming : randomUUID();
}

function safePath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "/";
  }
}

function errorCode(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const value = (error as { code?: unknown; name?: unknown }).code ?? (error as { name?: unknown }).name;
  return typeof value === "string" ? value.slice(0, 80) : null;
}

export async function withApiTelemetry(
  scope: string,
  request: Request,
  handler: () => Promise<Response>
) {
  const requestId = requestIdFrom(request);
  const startedAt = performance.now();

  try {
    const response = await handler();
    const durationMs = Math.max(0, Math.round((performance.now() - startedAt) * 10) / 10);
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    headers.append("Server-Timing", `app;dur=${durationMs}`);

    console.info(JSON.stringify({
      event: "api.request",
      scope,
      request_id: requestId,
      method: request.method,
      path: safePath(request),
      status: response.status,
      duration_ms: durationMs
    }));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  } catch (error) {
    const durationMs = Math.max(0, Math.round((performance.now() - startedAt) * 10) / 10);
    console.error(JSON.stringify({
      event: "api.error",
      scope,
      request_id: requestId,
      method: request.method,
      path: safePath(request),
      duration_ms: durationMs,
      error_code: errorCode(error)
    }));
    throw error;
  }
}
