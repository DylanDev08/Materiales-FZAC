import { getEnv, getSiteUrl, hasRealValue } from "@/lib/utils/env";

const FALLBACK_SITE_URL = "http://localhost:3000";

export const SITE_NAME = "Materiales FZAC";
export const SITE_DESCRIPTION =
  "Materiales para construcción, ferretería y obra en Rosario con stock validado, retiro coordinado y pago seguro.";
export const SOCIAL_IMAGE = "/fzac-storefront-hero.webp";
export const SOCIAL_IMAGE_WIDTH = 1920;
export const SOCIAL_IMAGE_HEIGHT = 789;
export const SITE_KEYWORDS = [
  "materiales de construcción Rosario",
  "corralón Rosario",
  "ferretería Rosario",
  "construcción en seco",
  "cemento y materiales para obra",
  "herramientas y pintura",
  "Fortaleza Construcciones",
  "Materiales FZAC"
];

export function getPublicSiteUrl() {
  const configured = getSiteUrl();

  try {
    return new URL(configured).origin;
  } catch {
    return FALLBACK_SITE_URL;
  }
}

export function toAbsoluteUrl(value: string) {
  try {
    return new URL(value, `${getPublicSiteUrl()}/`).toString();
  } catch {
    return `${getPublicSiteUrl()}/`;
  }
}

export function isSeoIndexingEnabled() {
  return getEnv("SEO_INDEXING_ENABLED").toLowerCase() === "true";
}

export function getPublicContact() {
  const email = getEnv("FZAC_EMAIL");
  const phone = getEnv("NEXT_PUBLIC_FZAC_WHATSAPP");
  const instagram = getEnv("FZAC_INSTAGRAM");

  return {
    email: hasRealValue(email) ? email : undefined,
    phone: hasRealValue(phone) ? phone : undefined,
    instagram: hasRealValue(instagram) && instagram.startsWith("http") ? instagram : undefined
  };
}
