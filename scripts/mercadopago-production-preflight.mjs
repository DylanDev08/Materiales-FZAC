const required = [
  "MERCADOPAGO_PRODUCTION_ACCESS_TOKEN",
  "NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY",
  "MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET",
  "NEXT_PUBLIC_SITE_URL"
];

function value(name) {
  return process.env[name]?.trim() ?? "";
}

function configured(name) {
  const current = value(name);
  return Boolean(current) && !/^<.*>$/.test(current);
}

const missing = required.filter((name) => !configured(name));
const problems = [];

if (value("PAYMENTS_ENV").toLowerCase() !== "production") {
  problems.push("PAYMENTS_ENV debe ser production.");
}
if (value("PAYMENTS_PRODUCTION_CONFIRMED").toLowerCase() !== "true") {
  problems.push("PAYMENTS_PRODUCTION_CONFIRMED debe ser true.");
}

try {
  const siteUrl = new URL(value("NEXT_PUBLIC_SITE_URL"));
  if (
    siteUrl.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(siteUrl.hostname)
  ) {
    problems.push("NEXT_PUBLIC_SITE_URL debe ser una URL HTTPS publica.");
  }
} catch {
  problems.push("NEXT_PUBLIC_SITE_URL no es una URL valida.");
}

if (missing.length || problems.length) {
  for (const name of missing) console.error(`PENDING: falta ${name}.`);
  for (const problem of problems) console.error(`PENDING: ${problem}`);
  console.error("No se contacto a Mercado Pago ni se mostraron credenciales.");
  process.exit(1);
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10_000);

try {
  const response = await fetch("https://api.mercadopago.com/users/me", {
    headers: {
      Authorization: `Bearer ${value("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN")}`
    },
    cache: "no-store",
    signal: controller.signal
  });

  if (!response.ok) {
    console.error(`Mercado Pago rechazo la autenticacion productiva (HTTP ${response.status}).`);
    process.exitCode = 1;
  } else {
    const account = await response.json();
    const tags = Array.isArray(account?.tags) ? account.tags.map(String) : [];
    const isTestUser = account?.test_user === true || tags.includes("test_user");
    const argentinaAccount = !account?.site_id || account.site_id === "MLA";

    if (isTestUser) {
      console.error("La credencial pertenece a un usuario tester y no puede habilitar cobros reales.");
      process.exitCode = 1;
    } else if (!argentinaAccount) {
      console.error("La cuenta autenticada no corresponde al sitio de Mercado Pago Argentina.");
      process.exitCode = 1;
    } else {
      console.log("Mercado Pago productivo: autenticacion valida para Argentina.");
      console.log("Preflight no destructivo: no se crearon preferencias, pagos ni reembolsos.");
      console.log("No se mostraron tokens, claves publicas ni datos de la cuenta.");
    }
  }
} catch (error) {
  const message = error instanceof Error && error.name === "AbortError"
    ? "Mercado Pago no respondio dentro de 10 segundos."
    : "No se pudo validar Mercado Pago por un error de red.";
  console.error(message);
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
