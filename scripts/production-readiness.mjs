const strict = process.argv.includes("--strict");

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function configured(name) {
  const current = value(name);
  return Boolean(current) && !/^<.*>$/.test(current);
}

function publicHttps(name) {
  try {
    const url = new URL(value(name));
    return url.protocol === "https:" && !["localhost", "127.0.0.1", "0.0.0.0"].includes(url.hostname);
  } catch {
    return false;
  }
}

const checks = [
  {
    area: "Sitio",
    requirement: "NEXT_PUBLIC_SITE_URL usa HTTPS publico",
    ok: publicHttps("NEXT_PUBLIC_SITE_URL")
  },
  {
    area: "Supabase",
    requirement: "Configuracion publica disponible",
    ok: configured("NEXT_PUBLIC_SUPABASE_URL") && configured("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  },
  {
    area: "Supabase",
    requirement: "Service role solo servidor disponible",
    ok: configured("SUPABASE_SERVICE_ROLE_KEY")
  },
  {
    area: "Pagos",
    requirement: "Proveedor Mercado Pago habilitado",
    ok:
      value("PAYMENTS_ENABLED").toLowerCase() === "true" &&
      value("PAYMENTS_PROVIDER").toLowerCase() === "mercadopago"
  },
  {
    area: "Pagos",
    requirement: "Token exclusivo de produccion disponible",
    ok: configured("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN")
  },
  {
    area: "Pagos",
    requirement: "Webhook firmado disponible",
    ok: configured("MERCADOPAGO_WEBHOOK_SECRET")
  },
  {
    area: "Pagos",
    requirement: "Activacion productiva confirmada",
    ok: value("PAYMENTS_PRODUCTION_CONFIRMED").toLowerCase() === "true"
  },
  {
    area: "Auth",
    requirement: "Administradores configurados en servidor",
    ok: configured("ADMIN_EMAILS") || configured("ADMIN_EMAIL")
  },
  {
    area: "Email",
    requirement: "Resend y remitente configurados",
    ok: configured("RESEND_API_KEY") && configured("RESEND_FROM_EMAIL")
  },
  {
    area: "Fiscal",
    requirement: "Proveedor fiscal configurado",
    ok:
      value("FISCAL_INVOICING_ENABLED").toLowerCase() === "true" &&
      configured("FISCAL_INVOICING_PROVIDER")
  }
];

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? "OK" : "PENDING"} [${check.area}] ${check.requirement}`);
}

console.log(`Production readiness: ${checks.length - failed.length}/${checks.length} controles completos.`);
console.log("No se mostraron valores de variables ni credenciales.");

if (strict && failed.length) process.exitCode = 1;
