function normalizeHttpOrigin(value: string | undefined) {
  if (!value?.trim()) return "";
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.origin;
  } catch {
    return "";
  }
}

function getTrustedAppOrigins() {
  const configured = [
    process.env.FZAC_PUBLIC_SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    ...(process.env.TRUSTED_APP_ORIGINS ?? "").split(",")
  ];

  return new Set(configured.map(normalizeHttpOrigin).filter(Boolean));
}

export function isTrustedMutationRequest(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;

  const origin = normalizeHttpOrigin(request.headers.get("origin") ?? undefined);
  if (!origin) return !request.headers.get("origin");

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const requestHost = request.headers.get("host")?.split(",")[0]?.trim() || requestUrl.host;
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

    // Normal same-origin traffic remains valid on Render and local development.
    if (originUrl.host === requestHost) return true;

    // Reverse proxies such as Vercel preserve the public host in x-forwarded-host.
    // Browser cross-site requests are already rejected above by Fetch Metadata.
    if (forwardedHost && originUrl.host === forwardedHost) return true;

    // Final custom domains can also be pinned explicitly as an exact allowlist.
    return getTrustedAppOrigins().has(originUrl.origin);
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

export async function readLimitedJson(request: Request, maxBytes = 16 * 1024) {
  const validation = validateJsonMutationRequest(request, maxBytes);
  if (!validation.ok) return validation;

  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      return { ok: false as const, status: 413, message: "La solicitud es demasiado grande." };
    }
    if (!text.trim()) {
      return { ok: false as const, status: 400, message: "La solicitud no contiene datos." };
    }
    return { ok: true as const, data: JSON.parse(text) as unknown };
  } catch {
    return { ok: false as const, status: 400, message: "No pudimos leer los datos de la solicitud." };
  }
}
