export const CURRENT_TERMS_VERSION = "2026-08-11";
export const CURRENT_PRIVACY_VERSION = "2026-08-11";

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
