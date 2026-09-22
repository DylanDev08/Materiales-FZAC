const strict = process.argv.includes("--strict");

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function configured(name) {
  const current = value(name);
  return Boolean(current) && !/^<.*>$/.test(current);
}

function siteUrlValue() {
  return value("FZAC_PUBLIC_SITE_URL") || value("NEXT_PUBLIC_SITE_URL");
}

function publicHttpsUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

function finalPublicDomain(raw) {
  if (!publicHttpsUrl(raw)) return false;
  const host = new URL(raw).hostname.toLowerCase();
  return !host.endsWith(".vercel.app") && !host.endsWith(".onrender.com");
}

const paymentProductionRequested =
  value("PAYMENTS_ENV").toLowerCase() === "production" ||
  value("PAYMENTS_PRODUCTION_CONFIRMED").toLowerCase() === "true";

const shippingConfigured =
  (configured("GOOGLE_MAPS_SERVER_KEY") ||
    configured("GOOGLE_MAPS_SERVER_API_KEY") ||
    configured("GOOGLE_DISTANCE_MATRIX_KEY")) &&
  configured("FZAC_SHIPPING_BASE_PRICE") &&
  configured("FZAC_SHIPPING_PRICE_PER_KM");

const checks = [
  {
    severity: "blocker",
    area: "Sitio",
    requirement: "URL publica canonica usa HTTPS",
    ok: publicHttpsUrl(siteUrlValue())
  },
  {
    severity: "blocker",
    area: "Sitio",
    requirement: "Dominio publico definitivo configurado",
    ok: finalPublicDomain(siteUrlValue())
  },
  {
    severity: "blocker",
    area: "Supabase",
    requirement: "Configuracion publica disponible",
    ok: configured("NEXT_PUBLIC_SUPABASE_URL") && configured("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  },
  {
    severity: "blocker",
    area: "Supabase",
    requirement: "Service role solo servidor disponible",
    ok: configured("SUPABASE_SERVICE_ROLE_KEY")
  },
  {
    severity: "blocker",
    area: "Auth",
    requirement: "Administradores configurados en servidor",
    ok: configured("ADMIN_EMAILS") || configured("ADMIN_EMAIL")
  },
  {
    severity: "blocker",
    area: "Seguridad",
    requirement: "Cloudflare Turnstile configurado en cliente y servidor",
    ok: configured("NEXT_PUBLIC_TURNSTILE_SITE_KEY") && configured("TURNSTILE_SECRET_KEY")
  },
  {
    severity: "blocker",
    area: "Legal",
    requirement: "Razon social, CUIT y domicilio comercial configurados",
    ok:
      configured("FZAC_LEGAL_NAME") &&
      configured("FZAC_CUIT") &&
      configured("FZAC_LEGAL_ADDRESS")
  },
  {
    severity: "blocker",
    area: "Consumidor",
    requirement: "Horario de atencion al consumidor configurado",
    ok: configured("FZAC_CUSTOMER_SERVICE_HOURS")
  },
  {
    severity: paymentProductionRequested ? "blocker" : "warning",
    area: "Pagos",
    requirement: "Mercado Pago productivo explicitamente habilitado",
    ok:
      value("PAYMENTS_ENABLED").toLowerCase() === "true" &&
      value("PAYMENTS_PROVIDER").toLowerCase() === "mercadopago" &&
      value("PAYMENTS_ENV").toLowerCase() === "production" &&
      value("PAYMENTS_PRODUCTION_CONFIRMED").toLowerCase() === "true"
  },
  {
    severity: paymentProductionRequested ? "blocker" : "warning",
    area: "Pagos",
    requirement: "Credenciales y webhook exclusivos de produccion disponibles",
    ok:
      configured("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN") &&
      configured("NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY") &&
      configured("MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET")
  },
  {
    severity: "warning",
    area: "Envios",
    requirement: "Cotizacion automatica por Google Routes y tarifa configurada",
    ok: shippingConfigured
  },
  {
    severity: "warning",
    area: "Email",
    requirement: "Resend y remitente propio configurados",
    ok: configured("RESEND_API_KEY") && configured("RESEND_FROM_EMAIL")
  },
  {
    severity: "warning",
    area: "SEO",
    requirement: "Indexacion habilitada con URL publica final",
    ok:
      value("SEO_INDEXING_ENABLED").toLowerCase() === "true" &&
      publicHttpsUrl(siteUrlValue())
  },
  {
    severity: "warning",
    area: "Fiscal",
    requirement: "Proveedor fiscal configurado cuando la facturacion fiscal esta habilitada",
    ok:
      value("FISCAL_INVOICING_ENABLED").toLowerCase() !== "true" ||
      configured("FISCAL_INVOICING_PROVIDER")
  }
];

const blockers = checks.filter((check) => check.severity === "blocker" && !check.ok);
const warnings = checks.filter((check) => check.severity === "warning" && !check.ok);

for (const check of checks) {
  const status = check.ok ? "OK" : check.severity === "blocker" ? "BLOCKER" : "PENDING";
  console.log(`${status} [${check.area}] ${check.requirement}`);
}

console.log(
  `Launch readiness: ${checks.length - blockers.length - warnings.length}/${checks.length} controles completos; ${blockers.length} bloqueantes; ${warnings.length} pendientes no bloqueantes.`
);
console.log(
  paymentProductionRequested
    ? "Modo cobros productivos solicitado: los controles de Mercado Pago son bloqueantes."
    : "Cobros productivos no activados: Mercado Pago real queda pendiente sin bloquear el deploy tecnico."
);
console.log("No se mostraron valores de variables ni credenciales.");

if (strict && blockers.length) process.exitCode = 1;
