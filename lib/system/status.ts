import "server-only";

import {
  getMercadoPagoEnvironmentState,
  getPaymentConfig,
  getPaymentProductionReadiness,
  isMercadoPagoConfigured
} from "@/lib/payments/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { getEnv, hasRealValue } from "@/lib/utils/env";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal/versions";
import { getStoreLegalIdentity } from "@/lib/legal/store-identity";
import { PRIVACY_CONSENT_VERSION } from "@/lib/privacy/consent";
import { isSeoIndexingEnabled } from "@/lib/seo/site";

type SystemStatusTone = "success" | "warning" | "danger";
export type SystemStatusArea = "Comercio" | "Infraestructura" | "Pagos" | "Seguridad";

export type SystemStatusItem = {
  area: SystemStatusArea;
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
    if (url.hostname.endsWith(".onrender.com")) return status("warning", "URL temporal");
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

type CatalogOperationalStatus = {
  activeProducts: number;
  readyProducts: number;
  activeCategories: number;
  missingImages: number;
  outOfStock: number;
};

async function getCatalogOperationalStatus(): Promise<CatalogOperationalStatus | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const [productsResult, categoriesResult] = await Promise.all([
    admin.from("products").select("id,active,price,stock,image_url,description,category_id").limit(1000),
    admin.from("categories").select("id,active").limit(500)
  ]);
  if (productsResult.error || categoriesResult.error) return null;

  const categoryIds = new Set(
    (categoriesResult.data ?? []).filter((category) => Boolean(category.active)).map((category) => String(category.id))
  );
  const activeProducts = (productsResult.data ?? []).filter((product) => Boolean(product.active));
  const readyProducts = activeProducts.filter(
    (product) =>
      Number(product.price ?? 0) > 0 &&
      Number(product.stock ?? 0) > 0 &&
      Boolean(String(product.image_url ?? "").trim()) &&
      Boolean(String(product.description ?? "").trim()) &&
      categoryIds.has(String(product.category_id ?? ""))
  );

  return {
    activeProducts: activeProducts.length,
    readyProducts: readyProducts.length,
    activeCategories: categoryIds.size,
    missingImages: activeProducts.filter((product) => !String(product.image_url ?? "").trim()).length,
    outOfStock: activeProducts.filter((product) => Number(product.stock ?? 0) <= 0).length
  };
}

export async function getSystemStatus() {
  const supabase = getSupabaseConfig();
  const payment = getPaymentConfig();
  const mercadoPago = getMercadoPagoEnvironmentState();
  const productionReadiness = getPaymentProductionReadiness();
  const resendConfigured = hasRealValue(getEnv("RESEND_API_KEY")) && hasRealValue(getEnv("RESEND_FROM_EMAIL"));
  const resendFrom = getEnv("RESEND_FROM_EMAIL");
  const fiscalInvoicingEnabled =
    getEnv("FISCAL_INVOICING_ENABLED").toLowerCase() === "true" &&
    hasRealValue(getEnv("FISCAL_INVOICING_PROVIDER"));
  const siteState = siteUrlState(payment.siteUrl);
  const productionMode = payment.paymentsEnv === "production";
  const seoEnabled = isSeoIndexingEnabled();
  const legalIdentity = getStoreLegalIdentity();
  const [integrity, catalog] = await Promise.all([getDatabaseIntegrityStatus(), getCatalogOperationalStatus()]);

  const items: SystemStatusItem[] = [
    {
      area: "Infraestructura",
      label: "Supabase público",
      ...configured(supabase.hasPublicConfig),
      detail: "Necesario para Auth, catálogo y sesiones del cliente."
    },
    {
      area: "Infraestructura",
      label: "Supabase privado",
      ...configured(supabase.hasServiceRole),
      detail: "Solo servidor. Permite operaciones administrativas, checkout, stock y notificaciones."
    },
    {
      area: "Infraestructura",
      label: "URL pública",
      ...siteState,
      detail: payment.siteUrl
    },
    {
      area: "Pagos",
      label: "Pagos online",
      ...(payment.paymentsEnabled ? status("success", "Activados") : status("warning", "Desactivados")),
      detail: `Proveedor: ${payment.provider || "mercadopago"}.`
    },
    {
      area: "Pagos",
      label: "Ambiente de pagos",
      ...(productionMode
        ? productionReadiness.active
          ? status("success", "Producción")
          : status("danger", "Producción bloqueada")
        : status("warning", "Prueba")),
      detail: productionMode
        ? productionReadiness.active
          ? "Usa credenciales productivas separadas y exige webhook firmado."
          : "Falta completar la confirmación o las credenciales exclusivas de producción."
        : "Usa sandbox. El comprador debe ser TESTUSER y no la cuenta vendedora."
    },
    {
      area: "Pagos",
      label: "Preparación de cobro real",
      ...(productionReadiness.ready ? status("success", "Lista para activar") : status("warning", "Bloqueada")),
      detail: productionReadiness.ready
        ? "La barrera productiva tiene URL HTTPS, webhook y token exclusivo."
        : `${productionReadiness.blockers.length} controles pendientes. No se habilitan cobros reales por accidente.`
    },
    {
      area: "Pagos",
      label: "Mercado Pago checkout",
      ...configured(isMercadoPagoConfigured("checkout")),
      detail: mercadoPago.hasCheckoutProAccessToken && mercadoPago.hasCheckoutProPublicKey
        ? "Credenciales de Checkout Pro disponibles."
        : "Falta token o public key para redirección."
    },
    {
      area: "Pagos",
      label: "Mercado Pago tarjeta",
      ...configured(isMercadoPagoConfigured("card")),
      detail: !mercadoPago.cardPaymentsEnabled
        ? "Desactivado hasta validar credenciales exclusivas para Card Brick."
        : mercadoPago.hasCardAccessToken && mercadoPago.hasCardPublicKey
        ? "Credenciales disponibles para Brick/tarjeta segura."
        : "Falta token o public key para tarjeta."
    },
    {
      area: "Pagos",
      label: "Webhook Mercado Pago",
      ...(mercadoPago.hasWebhookSecret ? status("success", "Firmado") : productionMode ? status("danger", "Crítico") : status("warning", "Sin firma test")),
      detail: mercadoPago.hasWebhookSecret
        ? `${payment.siteUrl.replace(/\/+$/, "")}/api/webhooks/mercadopago`
        : "En producción no debe aceptar eventos sin secreto."
    },
    {
      area: "Infraestructura",
      label: "Resend emails",
      ...configured(resendConfigured),
      detail: resendConfigured
        ? `Remitente configurado: ${resendFrom}. Verificar dominio y DNS en Resend.`
        : "Faltan RESEND_API_KEY o RESEND_FROM_EMAIL."
    },
    {
      area: "Comercio",
      label: "Facturación fiscal",
      ...(fiscalInvoicingEnabled ? status("success", "Proveedor configurado") : status("warning", "No integrada")),
      detail: fiscalInvoicingEnabled
        ? "Proveedor fiscal habilitado. Validar certificado, punto de venta y numeración antes de emitir."
        : "El comprobante FZAC es operativo y no reemplaza una factura fiscal de ARCA."
    },
    {
      area: "Comercio",
      label: "Identidad legal del comercio",
      ...(legalIdentity.legalName && legalIdentity.taxId
        ? status("success", "Completa")
        : status("danger", "Datos pendientes")),
      detail: legalIdentity.legalName && legalIdentity.taxId
        ? "Razón social, CUIT y domicilio están disponibles en textos y reportes."
        : "Completar FZAC_LEGAL_NAME y FZAC_CUIT con datos validados por el responsable fiscal."
    },
    {
      area: "Comercio",
      label: "Atención al consumidor",
      ...(legalIdentity.customerServiceHours
        ? status("success", "Horario publicado")
        : status("warning", "Horario pendiente")),
      detail: legalIdentity.customerServiceHours
        ? legalIdentity.customerServiceHours
        : "Definir FZAC_CUSTOMER_SERVICE_HOURS antes de iniciar cobros reales."
    },
    {
      area: "Seguridad",
      label: "Administradores",
      ...configured(hasRealValue(getEnv("ADMIN_EMAILS") || getEnv("ADMIN_EMAIL"))),
      detail: "El rol admin se valida por emails autorizados desde servidor."
    },
    {
      area: "Seguridad",
      label: "Checkout transaccional",
      ...(integrity?.atomic_checkout_function ? status("success", "Atómico") : status("danger", "No verificado")),
      detail: integrity?.atomic_checkout_function
        ? "Orden, productos y pago se guardan juntos o se revierten juntos."
        : "No pudimos verificar la función atómica de creación de pedidos."
    },
    {
      area: "Seguridad",
      label: "Idempotencia en base",
      ...(integrity?.idempotency_unique_index && integrity.duplicate_idempotency_keys === 0
        ? status("success", "Protegida")
        : status("danger", "Revisar")),
      detail: integrity
        ? `${integrity.duplicate_idempotency_keys} claves duplicadas. Índice único ${integrity.idempotency_unique_index ? "activo" : "inactivo"}.`
        : "No pudimos consultar la protección contra pedidos duplicados."
    },
    {
      area: "Comercio",
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
      area: "Seguridad",
      label: "Protección de privilegios",
      ...(integrity?.profile_privilege_guard ? status("success", "Activa") : status("danger", "No verificada")),
      detail: "Impide que un cliente se asigne permisos administrativos desde su perfil."
    },
    {
      area: "Comercio",
      label: "Integridad de stock",
      ...(integrity && integrity.negative_stock_products === 0
        ? status("success", "Sin negativos")
        : integrity
          ? status("danger", `${integrity.negative_stock_products} inconsistencias`)
          : status("warning", "Sin lectura")),
      detail: "Controla que ningún producto tenga stock por debajo de cero."
    },
    {
      area: "Comercio",
      label: "Catálogo publicable",
      ...(catalog && catalog.activeProducts > 0 && catalog.readyProducts === catalog.activeProducts
        ? status("success", "Completo")
        : catalog && catalog.activeProducts > 0
          ? status("warning", "Requiere ajustes")
          : status("danger", "Sin productos activos")),
      detail: catalog
        ? `${catalog.readyProducts} de ${catalog.activeProducts} productos listos. ${catalog.missingImages} sin foto y ${catalog.outOfStock} sin stock.`
        : "No pudimos consultar la calidad comercial del catálogo."
    },
    {
      area: "Comercio",
      label: "Categorías activas",
      ...(catalog && catalog.activeCategories > 0
        ? status("success", `${catalog.activeCategories} publicadas`)
        : status("danger", "Sin categorías")),
      detail: "Los productos necesitan una categoría activa para aparecer ordenados en la tienda."
    },
    {
      area: "Infraestructura",
      label: "SEO e indexación",
      ...(seoEnabled && siteState.tone === "success"
        ? status("success", "Indexación activa")
        : seoEnabled
          ? status("warning", "Dominio temporal")
          : status("warning", "Indexación bloqueada")),
      detail: seoEnabled
        ? "Robots y sitemap están habilitados. Confirmar dominio definitivo y Search Console."
        : "Se mantiene fuera de Google hasta definir el dominio definitivo y habilitar SEO_INDEXING_ENABLED."
    },
    {
      area: "Seguridad",
      label: "Versiones legales",
      ...status("success", "Versionadas"),
      detail: `Términos ${CURRENT_TERMS_VERSION}, privacidad ${CURRENT_PRIVACY_VERSION} y consentimiento ${PRIVACY_CONSENT_VERSION}.`
    }
  ];

  const pending = items.filter((item) => item.tone !== "success");
  return {
    items,
    pending,
    readyForProduction: pending.length === 0 && productionMode
  };
}
