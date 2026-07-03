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
