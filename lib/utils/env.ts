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

export function isConfigured(name: string) {
  return hasRealValue(getEnv(name));
}
