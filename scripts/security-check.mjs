import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["app", "components", "lib"];
const publicFiles = ["README.md", ".env.example", ".github", "docs", "scripts"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const secretNames = /SUPABASE_SERVICE_ROLE_KEY|MERCADOPAGO_ACCESS_TOKEN|MERCADOPAGO_WEBHOOK_SECRET|RESEND_API_KEY|ASSISTANT_LLM_API_KEY|MARKET_PRICE_FEED_TOKENS_JSON|MARKET_PRICE_CRON_SECRET/;
const secretValues = /APP_USR-[A-Za-z0-9-]{20,}|TEST-[A-Za-z0-9-]{20,}/;
const failures = [];

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
    if (/^[\s\r\n]*["']use client["'];/.test(content) && secretNames.test(content)) {
      failures.push(`${file}: un modulo cliente referencia el nombre de un secreto.`);
    }
  }
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
