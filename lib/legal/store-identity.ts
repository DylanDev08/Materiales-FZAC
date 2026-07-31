import { getEnv, hasRealValue } from "@/lib/utils/env";

const DEFAULT_ADDRESS = "Hermana Paula 3164, Rosario, Santa Fe, Argentina";
const DEFAULT_EMAIL = "fortalezaconstruccionesrosario@gmail.com";
const DEFAULT_PHONE = "+54 341 584 7000";

export function getStoreLegalIdentity() {
  const legalName = getEnv("FZAC_LEGAL_NAME");
  const taxId = getEnv("FZAC_CUIT");
  const address = getEnv("FZAC_LEGAL_ADDRESS") || DEFAULT_ADDRESS;
  const email = getEnv("FZAC_EMAIL") || DEFAULT_EMAIL;
  const phone = getEnv("FZAC_WHATSAPP") || DEFAULT_PHONE;
  const customerServiceHours = getEnv("FZAC_CUSTOMER_SERVICE_HOURS");

  return {
    commercialName: "Materiales FZAC - Fortaleza Construcciones",
    legalName: hasRealValue(legalName) ? legalName : null,
    taxId: hasRealValue(taxId) ? taxId : null,
    address,
    email,
    phone,
    customerServiceHours: hasRealValue(customerServiceHours) ? customerServiceHours : null
  };
}
