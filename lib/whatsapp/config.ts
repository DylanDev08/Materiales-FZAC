import "server-only";

function enabled(value: string | undefined, fallback = false) {
  if (value == null || !value.trim()) return fallback;
  return value.trim().toLowerCase() === "true";
}

function graphVersion(value: string | undefined) {
  const normalized = value?.trim() ?? "";
  return /^v\d{1,2}\.\d$/.test(normalized) ? normalized : "";
}

export function getWhatsAppConfig() {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "";
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim() ?? "";
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() ?? "";
  const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID?.trim() ?? "";
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim() ?? "";
  const version = graphVersion(process.env.WHATSAPP_GRAPH_API_VERSION);

  return {
    enabled: enabled(process.env.WHATSAPP_BOT_ENABLED),
    dryRun: enabled(process.env.WHATSAPP_BOT_DRY_RUN, true),
    verifyToken,
    accessToken,
    phoneNumberId,
    businessAccountId,
    appSecret,
    version,
    humanHandoffNumber:
      process.env.WHATSAPP_HUMAN_HANDOFF_NUMBER?.trim()
      || process.env.FZAC_WHATSAPP?.trim()
      || "",
    canVerifyWebhook: Boolean(verifyToken),
    canVerifySignature: Boolean(appSecret),
    canSend: Boolean(accessToken && /^\d{5,30}$/.test(phoneNumberId) && version)
  };
}
