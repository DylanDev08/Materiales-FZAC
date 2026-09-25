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
  return Boolean(current) &&
    !/^<.*>$/.test(current) &&
    !/(?:placeholder|changeme|change_me|replace_me|example|your[_-]|x{4,})/i.test(current);
}

function productionCredential(name) {
  return configured(name) && /^APP_USR-[A-Za-z0-9_-]{20,}$/.test(value(name));
}

function siteUrlValue() {
  return value("FZAC_PUBLIC_SITE_URL") || value("NEXT_PUBLIC_SITE_URL");
}

const credentialMissing = credentialRequired.filter((name) => !configured(name));
const releaseMissing = releaseRequired.filter((name) => !configured(name));
const credentialProblems = [];
const status = {
  hasProductionAccessToken: configured("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN"),
  hasProductionPublicKey: configured("NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY"),
  hasProductionWebhookSecret: configured("MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET"),
  productionAccessTokenFormatValid: productionCredential("MERCADOPAGO_PRODUCTION_ACCESS_TOKEN"),
  productionPublicKeyFormatValid: productionCredential("NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_PUBLIC_KEY"),
  credentialsReachable: false,
  environmentMatches: false,
  productionConfirmed: value("PAYMENTS_PRODUCTION_CONFIRMED").toLowerCase() === "true",
  cardEnabled: value("MERCADOPAGO_CARD_ENABLED").toLowerCase() === "true",
  cardAccessTokenUsesProductionFallback: !configured("MERCADOPAGO_PRODUCTION_CARD_ACCESS_TOKEN"),
  cardPublicKeyUsesProductionFallback: !configured("NEXT_PUBLIC_MERCADOPAGO_PRODUCTION_CARD_PUBLIC_KEY"),
  createdPreferences: false,
  createdPayments: false,
  createdRefunds: false
};

function printStatus() {
  console.log(JSON.stringify(status));
}

if (value("PAYMENTS_ENABLED").toLowerCase() !== "true" && value("PAYMENT_ENABLED").toLowerCase() !== "true") {
  credentialProblems.push("PAYMENTS_ENABLED debe estar habilitado.");
}
if ((value("PAYMENTS_PROVIDER") || "mercadopago").toLowerCase() !== "mercadopago") {
  credentialProblems.push("PAYMENTS_PROVIDER debe ser mercadopago.");
}
if (value("PAYMENTS_ENV").toLowerCase() !== "production") {
  credentialProblems.push("PAYMENTS_ENV debe ser production.");
}
if (!status.productionAccessTokenFormatValid) {
  credentialProblems.push("La credencial server-side no tiene formato productivo.");
}
if (status.hasProductionPublicKey && !status.productionPublicKeyFormatValid) {
  credentialProblems.push("La Public Key no tiene formato productivo.");
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
  status.environmentMatches = false;
  printStatus();
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
    printStatus();
    process.exitCode = 1;
  } else {
    const account = await response.json();
    const tags = Array.isArray(account?.tags) ? account.tags.map(String) : [];
    const isTestUser = account?.test_user === true || tags.includes("test_user");
    const argentinaAccount = !account?.site_id || account.site_id === "MLA";
    status.credentialsReachable = true;
    status.environmentMatches = !isTestUser && argentinaAccount;

    if (isTestUser) {
      printStatus();
      process.exitCode = 1;
    } else if (!argentinaAccount) {
      printStatus();
      process.exitCode = 1;
    } else {
      printStatus();
      if (releaseMissing.length) process.exitCode = 2;
    }
  }
} catch {
  status.credentialsReachable = false;
  printStatus();
  process.exitCode = 1;
} finally {
  clearTimeout(timeout);
}
