import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceRoots = ["app", "components", "lib"];
const publicFiles = ["README.md", ".env.example", "docs", "scripts"];
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const secretNames = /SUPABASE_SERVICE_ROLE_KEY|MERCADOPAGO_ACCESS_TOKEN|MERCADOPAGO_WEBHOOK_SECRET|SENDER_API_KEY/;
const secretValues = /APP_USR-[A-Za-z0-9-]{20,}|TEST-[A-Za-z0-9-]{20,}/;
const failures = [];

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

if (failures.length) {
  failures.forEach((failure) => process.stderr.write(`${failure}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write("Security check OK: no client-side secret references or versioned credential values found.\n");
}
