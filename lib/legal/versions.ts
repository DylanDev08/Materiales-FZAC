export const CURRENT_TERMS_VERSION = "2026-08-11";
export const CURRENT_PRIVACY_VERSION = "2026-09-24";

export type LegalAcceptanceSource = "REGISTER_EMAIL" | "REGISTER_GOOGLE" | "CHECKOUT";

export function createLegalAcceptance(source: LegalAcceptanceSource, acceptedAt = new Date().toISOString()) {
  return {
    accepted: true as const,
    accepted_at: acceptedAt,
    terms_version: CURRENT_TERMS_VERSION,
    privacy_version: CURRENT_PRIVACY_VERSION,
    source
  };
}

export type LegalAcceptance = ReturnType<typeof createLegalAcceptance>;

export function legalAcceptanceUserMetadata(acceptance: LegalAcceptance) {
  return {
    legal_terms_accepted: true,
    legal_terms_accepted_at: acceptance.accepted_at,
    legal_terms_version: acceptance.terms_version,
    legal_privacy_version: acceptance.privacy_version,
    legal_acceptance_source: acceptance.source
  };
}


export function hasRecordedLegalAcceptance(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.legal_terms_accepted === true
    && typeof metadata.legal_terms_accepted_at === "string"
    && typeof metadata.legal_terms_version === "string"
    && typeof metadata.legal_privacy_version === "string";
}

export function isFirstOAuthLogin(user: {
  created_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
}) {
  const provider = String(user.app_metadata?.provider ?? "").toLowerCase();
  if (provider !== "google") return false;

  const createdAt = Date.parse(user.created_at ?? "");
  const lastSignInAt = Date.parse(user.last_sign_in_at ?? "");
  if (!Number.isFinite(createdAt) || !Number.isFinite(lastSignInAt)) return false;

  return Math.abs(lastSignInAt - createdAt) <= 60_000;
}
