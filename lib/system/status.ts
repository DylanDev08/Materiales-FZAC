import "server-only";

import { getMercadoPagoEnvironmentState, getPaymentConfig, isMercadoPagoConfigured } from "@/lib/payments/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
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

type DatabaseIntegrityStatus = {
  orders_without_items: number;
  duplicate_idempotency_keys: number;
  negative_stock_products: number;
  atomic_checkout_function: boolean;
  idempotency_unique_index: boolean;
  profile_privilege_guard: boolean;
};

async function getDatabaseIntegrityStatus() {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.rpc("checkout_integrity_status");
  if (error || !data || typeof data !== "object") return null;
  return data as DatabaseIntegrityStatus;
}

export async function getSystemStatus() {
  const supabase = getSupabaseConfig();
  const payment = getPaymentConfig();
  const mercadoPago = getMercadoPagoEnvironmentState();
  const resendConfigured = hasRealValue(getEnv("RESEND_API_KEY")) && hasRealValue(getEnv("RESEND_FROM_EMAIL"));
  const resendFrom = getEnv("RESEND_FROM_EMAIL");
  const siteState = siteUrlState(payment.siteUrl);
  const productionMode = payment.paymentsEnv === "production";
  const integrity = await getDatabaseIntegrityStatus();

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
    },
    {
      label: "Checkout transaccional",
      ...(integrity?.atomic_checkout_function ? status("success", "Atómico") : status("danger", "No verificado")),
      detail: integrity?.atomic_checkout_function
        ? "Orden, productos y pago se guardan juntos o se revierten juntos."
        : "No pudimos verificar la función atómica de creación de pedidos."
    },
    {
      label: "Idempotencia en base",
      ...(integrity?.idempotency_unique_index && integrity.duplicate_idempotency_keys === 0
        ? status("success", "Protegida")
        : status("danger", "Revisar")),
      detail: integrity
        ? `${integrity.duplicate_idempotency_keys} claves duplicadas. Índice único ${integrity.idempotency_unique_index ? "activo" : "inactivo"}.`
        : "No pudimos consultar la protección contra pedidos duplicados."
    },
    {
      label: "Pedidos incompletos",
      ...(integrity && integrity.orders_without_items === 0
        ? status("success", "Sin errores")
        : integrity
          ? status("danger", `${integrity.orders_without_items} para revisar`)
          : status("warning", "Sin lectura")),
      detail: integrity?.orders_without_items
        ? "Son registros históricos sin productos. No se eliminan automáticamente para preservar la auditoría."
        : "Los pedidos nuevos conservan su detalle de productos."
    },
    {
      label: "Protección de privilegios",
      ...(integrity?.profile_privilege_guard ? status("success", "Activa") : status("danger", "No verificada")),
      detail: "Impide que un cliente se asigne permisos administrativos desde su perfil."
    },
    {
      label: "Integridad de stock",
      ...(integrity && integrity.negative_stock_products === 0
        ? status("success", "Sin negativos")
        : integrity
          ? status("danger", `${integrity.negative_stock_products} inconsistencias`)
          : status("warning", "Sin lectura")),
      detail: "Controla que ningún producto tenga stock por debajo de cero."
    }
  ];

  const pending = items.filter((item) => item.tone !== "success");
  return {
    items,
    pending,
    readyForProduction: pending.length === 0 && productionMode
  };
}
