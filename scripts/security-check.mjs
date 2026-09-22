import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["app", "components", "lib"];
const publicFiles = ["README.md", ".env.example", ".github", "docs", "scripts"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const secretNames = /SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|MERCADOPAGO_(?:ACCESS_TOKEN|CHECKOUT_PRO_ACCESS_TOKEN|PRODUCTION_ACCESS_TOKEN|CARD_ACCESS_TOKEN|PRODUCTION_CARD_ACCESS_TOKEN|WEBHOOK_SECRET|TEST_WEBHOOK_SECRET|PRODUCTION_WEBHOOK_SECRET)|RESEND_API_KEY|ASSISTANT_LLM_API_KEY|MARKET_PRICE_FEED_TOKENS_JSON|MARKET_PRICE_CRON_SECRET|GOOGLE_MAPS_(?:SERVER_KEY|SERVER_API_KEY)|GOOGLE_DISTANCE_MATRIX_KEY|WHATSAPP_(?:VERIFY_TOKEN|ACCESS_TOKEN|APP_SECRET)|NARANJAX_CLIENT_SECRET|TURNSTILE_SECRET_KEY/;
const secretValues = /APP_USR-[A-Za-z0-9-]{20,}|TEST-[A-Za-z0-9-]{20,}|(?<![A-Za-z0-9_])re_[A-Za-z0-9_]{20,}|sbp_[A-Za-z0-9_]{20,}|sb_secret_[A-Za-z0-9_-]{20,}|rnd_[A-Za-z0-9_]{20,}|AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|EAA[A-Za-z0-9]{30,}/;
const failures = [];
const criticalJsonMutationRoutes = [
  "app/api/auth/login/route.ts",
  "app/api/auth/register/route.ts",
  "app/api/auth/recover/route.ts",
  "app/api/auth/reset-password/route.ts",
  "app/api/cart/route.ts",
  "app/api/cart/validate/route.ts",
  "app/api/checkout/create/route.ts",
  "app/api/checkout/card/route.ts",
  "app/api/shipping/quote/route.ts",
  "app/api/assistant/route.ts"
];

async function exists(relativePath) {
  return access(path.join(root, relativePath)).then(() => true).catch(() => false);
}

async function filesAt(relativePath) {
  const absolutePath = path.join(root, relativePath);
  const entries = await readdir(absolutePath, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
    const child = path.join(relativePath, entry.name);
    if (entry.isDirectory()) files.push(...await filesAt(child));
    else files.push(child);
  }
  return files;
}

for (const sourceRoot of sourceRoots) {
  for (const file of await filesAt(sourceRoot)) {
    if (!sourceExtensions.has(path.extname(file))) continue;
    const content = await readFile(path.join(root, file), "utf8");
    if (secretValues.test(content)) failures.push(`${file}: contiene una credencial hardcodeada.`);
    if (/^[\s\r\n]*["']use client["'];/.test(content) && secretNames.test(content)) {
      failures.push(`${file}: un modulo cliente referencia el nombre de un secreto.`);
    }
  }
}

for (const file of criticalJsonMutationRoutes) {
  const content = await readFile(path.join(root, file), "utf8").catch(() => "");
  if (!content.includes("validateJsonMutationRequest") && !content.includes("readLimitedJson")) {
    failures.push(`${file}: falta validar origen, tipo y tamano del cuerpo JSON.`);
  }
}

const legacyCheckout = await readFile(path.join(root, "app/api/checkout/route.ts"), "utf8");
if (!/export\s*\{\s*POST\s*\}\s*from\s*["']\.\/create\/route["']/.test(legacyCheckout)) {
  failures.push("app/api/checkout/route.ts: el endpoint legacy debe delegar al handler canonico /api/checkout/create.");
}

for (const file of ["app/api/checkout/create/route.ts", "app/api/checkout/card/route.ts"]) {
  const content = await readFile(path.join(root, file), "utf8");
  if (!content.includes("getCurrentUser")) {
    failures.push(`${file}: el rate limit de compra debe derivarse de la sesion autenticada.`);
  }
  if (/rateLimitIdentity\([^\n]+payload(?:\.checkout)?\.customer\.email/.test(content)) {
    failures.push(`${file}: no usar email controlado por el cliente como identidad de rate limit.`);
  }
}

const registerRoute = await readFile(path.join(root, "app/api/auth/register/route.ts"), "utf8");
if (/findRegistrationDuplicate|duplicateMessage/.test(registerRoute)) {
  failures.push("app/api/auth/register/route.ts: el alta publica no debe revelar si email, telefono o nombre ya existen.");
}

const envExample = await readFile(path.join(root, ".env.example"), "utf8").catch(() => "");
if (/^NEXT_PUBLIC_\w*(?:SERVICE_ROLE|ACCESS_TOKEN|WEBHOOK_SECRET|CLIENT_SECRET|APP_SECRET|SERVER_KEY|PRIVATE_KEY)\w*=/gim.test(envExample)) {
  failures.push(".env.example: un secreto de servidor no debe declararse como NEXT_PUBLIC_*.");
}

for (const entry of publicFiles) {
  const files = path.extname(entry) ? [entry] : await filesAt(entry);
  for (const file of files) {
    const content = await readFile(path.join(root, file), "utf8").catch(() => "");
    if (secretValues.test(content)) failures.push(`${file}: contiene una credencial con formato real.`);
  }
}

const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
if (!String(packageJson.packageManager ?? "").startsWith("pnpm@")) {
  failures.push("package.json: packageManager debe fijar una version de pnpm.");
}
if (!(await exists("pnpm-lock.yaml"))) {
  failures.push("Falta pnpm-lock.yaml para instalaciones reproducibles.");
}
if (await exists("package-lock.json")) {
  failures.push("package-lock.json no debe convivir con pnpm-lock.yaml.");
}

const renderConfig = await readFile(path.join(root, "render.yaml"), "utf8").catch(() => "");
if (/\bnpm\s+(?:ci|install|run)\b|\bnpx\b/.test(renderConfig)) {
  failures.push("render.yaml: el deploy debe usar pnpm de forma exclusiva.");
}

const dockerConfig = await readFile(path.join(root, "Dockerfile"), "utf8").catch(() => "");
if (!dockerConfig.includes("pnpm install --frozen-lockfile") || /\bnpm\s+(?:ci|install|run)\b|\bnpx\b/.test(dockerConfig)) {
  failures.push("Dockerfile: el contenedor debe instalar y ejecutar exclusivamente con pnpm.");
}

const assistantRoute = await readFile(path.join(root, "app/api/assistant/route.ts"), "utf8").catch(() => "");
if (!assistantRoute.includes("persistenceConsent") || !assistantRoute.includes("skipAssistantPersistence") || !assistantRoute.includes("preferenceConsentCookieEnabled")) {
  failures.push("app/api/assistant/route.ts: la persistencia debe depender del consentimiento de preferencias.");
}
if (!assistantRoute.includes("assessAssistantInput") || !assistantRoute.includes("createAssistantPlan")) {
  failures.push("app/api/assistant/route.ts: faltan guardrails u orquestacion segura del asistente.");
}

const assistantTools = await readFile(path.join(root, "lib/assistant/tools.ts"), "utf8").catch(() => "");
if (!assistantTools.includes('.eq("user_id", userId)')) {
  failures.push("lib/assistant/tools.ts: la consulta de pedidos debe estar limitada al usuario autenticado.");
}

const languageModel = await readFile(path.join(root, "lib/assistant/language-model.ts"), "utf8").catch(() => "");
if (!languageModel.includes("ASSISTANT_LLM_ALLOWED_HOSTS") || !languageModel.includes("redactAssistantSensitiveText")) {
  failures.push("lib/assistant/language-model.ts: el proveedor opcional requiere allowlist y redaccion previa.");
}

const proxyConfig = await readFile(path.join(root, "proxy.ts"), "utf8").catch(() => "");
for (const header of ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "Referrer-Policy"]) {
  if (!proxyConfig.includes(header)) failures.push(`proxy.ts: falta el header defensivo ${header}.`);
}
if (!proxyConfig.includes("script-src-attr 'none'")) {
  failures.push("proxy.ts: la CSP debe bloquear handlers inline con script-src-attr 'none'.");
}

const requireAdmin = await readFile(path.join(root, "lib/auth/require-admin.ts"), "utf8").catch(() => "");
const apiGuards = await readFile(path.join(root, "lib/auth/api-guards.ts"), "utf8").catch(() => "");
const adminMfa = await readFile(path.join(root, "lib/auth/admin-mfa.ts"), "utf8").catch(() => "");
if (!requireAdmin.includes("hasAdminAal2") || !apiGuards.includes("hasAdminAal2") || !adminMfa.includes("getAuthenticatorAssuranceLevel")) {
  failures.push("Admin: el panel y las APIs deben exigir MFA/AAL2.");
}

for (const file of [
  "app/api/auth/login/route.ts",
  "app/api/auth/register/route.ts",
  "app/api/checkout/create/route.ts",
  "app/api/checkout/card/route.ts"
]) {
  const content = await readFile(path.join(root, file), "utf8").catch(() => "");
  if (!content.includes("distributedRateLimitRequest")) {
    failures.push(`${file}: falta el rate limit distribuido.`);
  }
}

const productUpload = await readFile(path.join(root, "app/api/admin/uploads/product-image/route.ts"), "utf8").catch(() => "");
if (!productUpload.includes('from "sharp"') || !productUpload.includes(".webp(") || !productUpload.includes("limitInputPixels")) {
  failures.push("Upload de productos: falta decodificar/re-encodear la imagen con limites de pixels.");
}

for (const file of await filesAt(".github/workflows")) {
  const content = await readFile(path.join(root, file), "utf8");
  const unpinnedAction = content.match(/^\s*uses:\s*[^\s#]+@(?![a-f0-9]{40}(?:\s|#|$))[^\s#]+/gim);
  if (unpinnedAction) failures.push(`${file}: las acciones externas deben estar fijadas por SHA.`);
}

if (failures.length) {
  failures.forEach((failure) => process.stderr.write(`${failure}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write("Security check OK: secrets and package-manager controls passed.\n");
}
