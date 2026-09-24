const credentialRequired = [
  "MERCADOPAGO_PRODUCTION_ACCESS_TOKEN"
];

const releaseRequired = [
  "NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY",
  "MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET"
];

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

const credentialMissing = credentialRequired.filter((name) => !configured(name));
const releaseMissing = releaseRequired.filter((name) => !configured(name));
const credentialProblems = [];

if (value("PAYMENTS_ENABLED").toLowerCase() !== "true" && value("PAYMENT_ENABLED").toLowerCase() !== "true") {
  credentialProblems.push("PAYMENTS_ENABLED debe estar habilitado.");
}
if ((value("PAYMENTS_PROVIDER") || "mercadopago").toLowerCase() !== "mercadopago") {
  credentialProblems.push("PAYMENTS_PROVIDER debe ser mercadopago.");
}
if (value("PAYMENTS_ENV").toLowerCase() !== "production") {
  credentialProblems.push("PAYMENTS_ENV debe ser production.");
}

try {
  const siteUrl = new URL(siteUrlValue());
  if (
    siteUrl.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "0.0.0.0"].includes(siteUrl.hostname)
  ) {
    credentialProblems.push("FZAC_PUBLIC_SITE_URL o NEXT_PUBLIC_SITE_URL debe ser una URL HTTPS publica.");
  }
} catch {
  credentialProblems.push("FZAC_PUBLIC_SITE_URL o NEXT_PUBLIC_SITE_URL no contiene una URL valida.");
}

if (credentialMissing.length || credentialProblems.length) {
  for (const name of credentialMissing) console.error(`PENDING: falta ${name}.`);
  for (const problem of credentialProblems) console.error(`PENDING: ${problem}`);
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
      console.log("Mercado Pago productivo: autenticacion server-side valida para Argentina.");
      console.log("Preflight no destructivo: no se crearon preferencias, pagos ni reembolsos.");
      console.log("No se mostraron tokens, claves publicas ni datos de la cuenta.");

      for (const name of releaseMissing) {
        console.warn(`RELEASE PENDING: falta ${name} en el entorno que corresponda.`);
      }

      if (value("PAYMENTS_PRODUCTION_CONFIRMED").toLowerCase() !== "true") {
        console.log("SAFE GATE: PAYMENTS_PRODUCTION_CONFIRMED sigue desactivado. El preflight no habilita cobros.");
      } else {
        console.warn("ATENCION: PAYMENTS_PRODUCTION_CONFIRMED ya esta activo.");
      }

      if (value("MERCADOPAGO_CARD_ENABLED").toLowerCase() !== "true") {
        console.log("SAFE GATE: MERCADOPAGO_CARD_ENABLED sigue desactivado.");
      }

      if (releaseMissing.length) process.exitCode = 2;
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
