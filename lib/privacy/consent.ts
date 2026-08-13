export const PRIVACY_CONSENT_VERSION = "2026-08-11";
export const PRIVACY_CONSENT_STORAGE_KEY = "fzac-privacy-consent-v1";
export const PRIVACY_CONSENT_COOKIE = "fzac_privacy_consent";
export const PRIVACY_CONSENT_EVENT = "fzac:privacy-consent-changed";
export const PRIVACY_SETTINGS_OPEN_EVENT = "fzac:privacy-settings-open";

const OPTIONAL_LOCAL_STORAGE_KEYS = [
  "fzac-search-recent-v1",
  "fzac-assistant-history-v1",
  "fzac-assistant-conversation-id",
  "fzac-visitor-id"
] as const;

export type PrivacyConsent = {
  version: string;
  decidedAt: string;
  necessary: true;
  preferences: boolean;
  analytics: false;
  marketing: false;
};

function isConsent(value: unknown): value is PrivacyConsent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PrivacyConsent>;
  return (
    candidate.version === PRIVACY_CONSENT_VERSION &&
    typeof candidate.decidedAt === "string" &&
    candidate.necessary === true &&
    typeof candidate.preferences === "boolean" &&
    candidate.analytics === false &&
    candidate.marketing === false
  );
}

export function readPrivacyConsent(): PrivacyConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRIVACY_CONSENT_STORAGE_KEY) || "null") as unknown;
    return isConsent(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function preferencesAllowed() {
  return readPrivacyConsent()?.preferences === true;
}

export function preferenceConsentCookieEnabled(cookieHeader: string | null | undefined) {
  if (!cookieHeader) return false;
  return cookieHeader
    .split(";")
    .some((entry) => entry.trim() === `${PRIVACY_CONSENT_COOKIE}=v1.p1`);
}

export function preferenceStorage(): Storage {
  return preferencesAllowed() ? window.localStorage : window.sessionStorage;
}

function removeOptionalLocalData() {
  for (const key of OPTIONAL_LOCAL_STORAGE_KEYS) window.localStorage.removeItem(key);
}

export function savePrivacyConsent(preferences: boolean) {
  const consent: PrivacyConsent = {
    version: PRIVACY_CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
    necessary: true,
    preferences,
    analytics: false,
    marketing: false
  };

  window.localStorage.setItem(PRIVACY_CONSENT_STORAGE_KEY, JSON.stringify(consent));
  if (!preferences) removeOptionalLocalData();

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PRIVACY_CONSENT_COOKIE}=v1.p${preferences ? 1 : 0}; Path=/; Max-Age=15552000; SameSite=Lax${secure}`;
  window.dispatchEvent(new CustomEvent<PrivacyConsent>(PRIVACY_CONSENT_EVENT, { detail: consent }));
  return consent;
}

export function subscribePrivacyConsent(listener: (consent: PrivacyConsent | null) => void) {
  const onConsent = (event: Event) => listener((event as CustomEvent<PrivacyConsent>).detail ?? readPrivacyConsent());
  const onStorage = (event: StorageEvent) => {
    if (event.key === PRIVACY_CONSENT_STORAGE_KEY) listener(readPrivacyConsent());
  };

  window.addEventListener(PRIVACY_CONSENT_EVENT, onConsent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(PRIVACY_CONSENT_EVENT, onConsent);
    window.removeEventListener("storage", onStorage);
  };
}
