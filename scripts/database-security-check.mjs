import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const migrationRoot = path.join(root, "supabase", "migrations");
const migrationFiles = (await readdir(migrationRoot)).filter((file) => file.endsWith(".sql")).sort();
const migrations = await Promise.all(
  migrationFiles.map(async (file) => ({ file, sql: await readFile(path.join(migrationRoot, file), "utf8") }))
);
const allSql = migrations.map(({ sql }) => sql).join("\n");
const normalizedSql = allSql.toLowerCase();
const failures = [];

const createdTables = new Set();
for (const { sql } of migrations) {
  for (const match of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\."?([a-z_][a-z0-9_]*)"?/gi)) {
    createdTables.add(match[1].toLowerCase());
  }
}

for (const table of createdTables) {
  const forcePattern = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\."?${table}"?\\s+force\\s+row\\s+level\\s+security`,
    "i"
  );
  if (!forcePattern.test(allSql)) failures.push(`${table}: falta FORCE ROW LEVEL SECURITY.`);
}

for (const required of [
  "payments_provider_session_unique_idx",
  "payment_events_provider_event_unique_idx",
  "payments_provider_payment_unique_idx",
  "validate_profile_contact_integrity",
  "validate_category_integrity",
  "validate_product_commercial_integrity",
  "validate_product_image_integrity",
  "validate_order_customer_integrity",
  "protect_order_commercial_snapshot",
  "validate_payment_order_integrity",
  "protect_public_store_settings",
  "validate_notification_integrity",
  "validate_conversation_identity",
  "validate_consumer_request_integrity",
  "protect_notification_content",
  "protect_review_moderation",
  "enforce_user_collection_limits",
  "sync_user_cart",
  "admin_transition_order"
]) {
  if (!normalizedSql.includes(required)) failures.push(`Falta el control de integridad ${required}.`);
}

if (/create\s+policy[\s\S]{0,300}on\s+public\.(orders|payments|purchase_tickets|payment_events|admin_audit_logs)[\s\S]{0,300}with\s+check\s*\(\s*true\s*\)/i.test(allSql)) {
  failures.push("Una tabla sensible contiene una policy de escritura WITH CHECK (true)." );
}

if (/grant\s+execute\s+on\s+function\s+public\.(finalize_paid_order|finalize_refunded_order|create_checkout_order|admin_transition_order)[\s\S]{0,120}\s+to\s+(public|anon|authenticated)/i.test(allSql)) {
  failures.push("Una RPC financiera sensible concede EXECUTE a un rol publico." );
}

if (!/revoke\s+execute\s+on\s+function\s+public\.archive_assistant_knowledge_version\(\)\s+from\s+public,\s*anon,\s*authenticated/i.test(allSql)) {
  failures.push("La funcion SECURITY DEFINER del conocimiento no revoca EXECUTE publico." );
}

const finalHardening = migrations.find(({ file }) => file === "20260812010000_database_integrity_hardening.sql")?.sql ?? "";
if (!/drop\s+policy\s+if\s+exists\s+"search events owner insert"/i.test(finalHardening)
  || !/revoke\s+insert\s+on\s+table\s+public\.search_events\s+from\s+anon,\s*authenticated/i.test(finalHardening)) {
  failures.push("Los eventos de busqueda conservan un camino de escritura publica." );
}

const approveRoute = await readFile(path.join(root, "app/api/admin/orders/[id]/approve/route.ts"), "utf8");
const rejectRoute = await readFile(path.join(root, "app/api/admin/orders/[id]/reject/route.ts"), "utf8");
if (!approveRoute.includes('rpc("admin_transition_order"') || !rejectRoute.includes('rpc("admin_transition_order"')) {
  failures.push("Las transiciones administrativas de pedidos no usan la RPC atomica." );
}

if (failures.length) {
  failures.forEach((failure) => process.stderr.write(`${failure}\n`));
  process.exitCode = 1;
} else {
  process.stdout.write(`Database security check OK: ${createdTables.size} public tables require FORCE RLS.\n`);
}
