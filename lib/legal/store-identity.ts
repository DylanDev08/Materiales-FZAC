import { getEnv, hasRealValue } from "@/lib/utils/env";

const DEFAULT_ADDRESS = "Hermana Paula 3164, Rosario, Santa Fe, Argentina";
const DEFAULT_EMAIL = "fortalezaconstruccionesrosario@gmail.com";
const DEFAULT_PHONE = "+54 341 584 7000";
const DEFAULT_CUIT = "20-36454125-3";
const DEFAULT_COMMERCIAL_NAME = "Fortaleza Construcciones";
const DEFAULT_BRAND_NAME = "FZACONSTRUCCIONES";

function formatCuit(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value.trim();
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

export function getStoreLegalIdentity() {
  const legalName = getEnv("FZAC_LEGAL_NAME");
  const taxId = getEnv("FZAC_CUIT") || DEFAULT_CUIT;
  const commercialName = getEnv("FZAC_COMMERCIAL_NAME") || DEFAULT_COMMERCIAL_NAME;
  const brandName = getEnv("FZAC_BRAND_NAME") || DEFAULT_BRAND_NAME;
  const address = getEnv("FZAC_LEGAL_ADDRESS") || DEFAULT_ADDRESS;
  const email = getEnv("FZAC_EMAIL") || DEFAULT_EMAIL;
  const phone = getEnv("FZAC_WHATSAPP") || DEFAULT_PHONE;
  const customerServiceHours = getEnv("FZAC_CUSTOMER_SERVICE_HOURS");

  return {
    commercialName,
    brandName,
    legalName: hasRealValue(legalName) ? legalName : null,
    taxId: hasRealValue(taxId) ? formatCuit(taxId) : null,
    address,
    email,
    phone,
    customerServiceHours: hasRealValue(customerServiceHours) ? customerServiceHours : null
  };
}
