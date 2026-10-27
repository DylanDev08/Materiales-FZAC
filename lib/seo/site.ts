import { getEnv, getSiteUrl, hasRealValue } from "@/lib/utils/env";

const FALLBACK_SITE_URL = "http://localhost:3000";

export const SITE_NAME = "Materiales FZAC";
export const SITE_DESCRIPTION =
  "Materiales para construcción en Rosario: Durlock, Steel Framing, ferretería, pintura e impermeabilización. Consultá precios y disponibilidad, armá tu pedido y coordiná el retiro o envío.";
export const SOCIAL_IMAGE = "/fzac-storefront-hero.webp";
export const SOCIAL_IMAGE_WIDTH = 1920;
export const SOCIAL_IMAGE_HEIGHT = 789;
export const SITE_KEYWORDS = [
  "materiales de construcción Rosario",
  "corralón Rosario",
  "ferretería Rosario",
  "construcción en seco Rosario",
  "Durlock Rosario",
  "Steel Framing Rosario",
  "impermeabilizantes Rosario",
  "pinturas Rosario",
  "cemento y materiales para obra",
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
  const configured = getEnv("SEO_INDEXING_ENABLED").toLowerCase();
  const siteUrl = getPublicSiteUrl();
  const isProductionSite = siteUrl === "https://www.fzacmateriales.store" || siteUrl === "https://fzacmateriales.store";
  const maintenanceMode = getEnv("MAINTENANCE_MODE").toLowerCase() === "true";
  const vercelEnvironment = getEnv("VERCEL_ENV").toLowerCase();

  // Never let an explicit SEO override expose previews or maintenance pages
  // to search crawlers. Preserve SEO_INDEXING_ENABLED=false as a kill switch.
  return isProductionSite &&
    !maintenanceMode &&
    configured !== "false" &&
    (!vercelEnvironment || vercelEnvironment === "production");
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
