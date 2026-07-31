export function isTrustedMutationRequest(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost = forwardedHost || request.headers.get("host") || new URL(request.url).host;
    return originUrl.host === requestHost;
  } catch {
    return false;
  }
}

export function validateJsonMutationRequest(request: Request, maxBytes = 16 * 1024) {
  if (!isTrustedMutationRequest(request)) {
    return { ok: false as const, status: 403, message: "Origen de solicitud no permitido." };
  }

  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    return { ok: false as const, status: 415, message: "El contenido debe enviarse como JSON." };
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    return { ok: false as const, status: 413, message: "La solicitud es demasiado grande." };
  }

  return { ok: true as const };
}
