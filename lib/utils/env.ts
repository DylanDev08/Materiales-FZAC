const PLACEHOLDER_PATTERN = /^<.*>$/;

export function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function hasRealValue(value: string | undefined): value is string {
  if (!value) return false;
  return !PLACEHOLDER_PATTERN.test(value.trim());
}

export function getSiteUrl() {
  return getEnv("NEXT_PUBLIC_SITE_URL") || "http://localhost:3000";
}

function isLocalUrl(value: string) {
  try {
    const url = new URL(value);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return true;
  }
}

export function getRequestSiteUrl(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : requestUrl.protocol.replace(":", "");
  const forwardedOrigin = forwardedHost ? `${protocol}://${forwardedHost}` : "";
  const requestOrigin = forwardedOrigin || requestUrl.origin;
  const configured = getSiteUrl();

  return !isLocalUrl(requestOrigin) || isLocalUrl(configured) ? requestOrigin : configured;
}

export function getAdminEmails() {
  return (getEnv("ADMIN_EMAILS") || getEnv("ADMIN_EMAIL"))
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminConsolePath() {
  const configured = getEnv("ADMIN_CONSOLE_PATH");
  const path = configured.startsWith("/") ? configured : `/${configured}`;
  return path.length > 1 ? path.replace(/\/+$/, "") : "/fzac-admin-crs-2026";
}

export function isConfigured(name: string) {
  return hasRealValue(getEnv(name));
}
