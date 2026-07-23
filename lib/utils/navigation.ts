const INTERNAL_ORIGIN = "https://fzac.internal";

const UNSAFE_PATH_CHARS = /[\u0000-\u001f\u007f\\\\]/;

export function safeInternalPath(value: string | null | undefined, fallback = "/cuenta") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (UNSAFE_PATH_CHARS.test(value)) return fallback;

  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || UNSAFE_PATH_CHARS.test(decoded)) return fallback;

    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
