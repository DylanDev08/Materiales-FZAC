const PLACEHOLDER_PATTERN = /^<.*>$/;

export function getEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function hasRealValue(value: string | undefined): value is string {
  if (!value) return false;
  return !PLACEHOLDER_PATTERN.test(value.trim());
}

function getVercelSiteUrl() {
  const raw = getEnv("VERCEL_PROJECT_PRODUCTION_URL") || getEnv("VERCEL_URL");
  if (!raw) return "";

  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

export function getSiteUrl() {
  return (
    getEnv("FZAC_PUBLIC_SITE_URL") ||
    getEnv("NEXT_PUBLIC_SITE_URL") ||
    getVercelSiteUrl() ||
    "http://localhost:3000"
  );
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

  if (hasRealValue(configured) && !isLocalUrl(configured)) {
    return new URL(configured).origin;
  }

  return new URL(requestOrigin).origin;
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
