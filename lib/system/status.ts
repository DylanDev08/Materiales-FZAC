import "server-only";

import { getMercadoPagoEnvironmentState, getPaymentConfig, isMercadoPagoConfigured } from "@/lib/payments/config";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getEnv, hasRealValue } from "@/lib/utils/env";

type SystemStatusTone = "success" | "warning" | "danger";

export type SystemStatusItem = {
  label: string;
  value: string;
  tone: SystemStatusTone;
  detail: string;
};

function status(tone: SystemStatusTone, value: string) {
  return { tone, value };
}

function configured(value: boolean) {
  return value ? status("success", "Configurado") : status("danger", "Pendiente");
}

function siteUrlState(siteUrl: string) {
  try {
    const url = new URL(siteUrl);
    const local = ["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) return status("danger", "URL insegura");
    if (local) return status("warning", "Local");
    return status("success", "HTTPS público");
  } catch {
    return status("danger", "Inválida");
  }
}

export function getSystemStatus() {
  const supabase = getSupabaseConfig();
  const payment = getPaymentConfig();
  const mercadoPago = getMercadoPagoEnvironmentState();
  const resendConfigured = hasRealValue(getEnv("RESEND_API_KEY")) && hasRealValue(getEnv("RESEND_FROM_EMAIL"));
  const resendFrom = getEnv("RESEND_FROM_EMAIL");
  const siteState = siteUrlState(payment.siteUrl);
  const productionMode = payment.paymentsEnv === "production";

  const items: SystemStatusItem[] = [
    {
      label: "Supabase público",
      ...configured(supabase.hasPublicConfig),
      detail: "Necesario para Auth, catálogo y sesiones del cliente."
    },
    {
      label: "Supabase privado",
      ...configured(supabase.hasServiceRole),
      detail: "Solo servidor. Permite operaciones administrativas, checkout, stock y notificaciones."
    },
    {
      label: "URL pública",
      ...siteState,
      detail: payment.siteUrl
    },
    {
      label: "Pagos online",
      ...(payment.paymentsEnabled ? status("success", "Activados") : status("warning", "Desactivados")),
      detail: `Proveedor: ${payment.provider || "mercadopago"}.`
    },
    {
      label: "Ambiente de pagos",
      ...(productionMode ? status("success", "Producción") : status("warning", "Prueba")),
      detail: productionMode
        ? "Usa credenciales productivas y exige webhook firmado."
        : "Usa sandbox. El comprador debe ser TESTUSER y no la cuenta vendedora."
    },
    {
      label: "Mercado Pago checkout",
      ...configured(isMercadoPagoConfigured("checkout")),
      detail: mercadoPago.hasCheckoutProAccessToken && mercadoPago.hasCheckoutProPublicKey
        ? "Credenciales de Checkout Pro disponibles."
        : "Falta token o public key para redirección."
    },
    {
      label: "Mercado Pago tarjeta",
      ...configured(isMercadoPagoConfigured("card")),
      detail: mercadoPago.hasCardAccessToken && mercadoPago.hasCardPublicKey
        ? "Credenciales disponibles para Brick/tarjeta segura."
        : "Falta token o public key para tarjeta."
    },
    {
      label: "Webhook Mercado Pago",
      ...(mercadoPago.hasWebhookSecret ? status("success", "Firmado") : productionMode ? status("danger", "Crítico") : status("warning", "Sin firma test")),
      detail: mercadoPago.hasWebhookSecret
        ? `${payment.siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`
        : "En producción no debe aceptar eventos sin secreto."
    },
    {
      label: "Resend emails",
      ...configured(resendConfigured),
      detail: resendConfigured
        ? `Remitente configurado: ${resendFrom}. Verificar dominio y DNS en Resend.`
        : "Faltan RESEND_API_KEY o RESEND_FROM_EMAIL."
    },
    {
      label: "Administradores",
      ...configured(hasRealValue(getEnv("ADMIN_EMAILS") || getEnv("ADMIN_EMAIL"))),
      detail: "El rol admin se valida por emails autorizados desde servidor."
    }
  ];

  const pending = items.filter((item) => item.tone !== "success");
  return {
    items,
    pending,
    readyForProduction: pending.length === 0 && productionMode
  };
}
