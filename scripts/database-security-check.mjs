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

const removedLegacyTables = new Set(["product_images"]);

for (const table of createdTables) {
  if (removedLegacyTables.has(table)) continue;
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
  "validate_order_customer_integrity",
  "protect_order_commercial_snapshot",
  "validate_payment_order_integrity",
  "protect_public_store_settings",
  "validate_notification_integrity",
  "validate_conversation_identity",
  "protect_notification_content",
  "protect_review_moderation",
  "enforce_user_collection_limits",
  "sync_user_cart",
  "admin_transition_order",
  "admin_bulk_void_financial_movements",
  "guard_order_fulfillment_requires_items",
  "guard_paid_payment_requires_items"
]) {
  if (!normalizedSql.includes(required)) failures.push(`Falta el control de integridad ${required}.`);
}

if (/create\s+policy[\s\S]{0,300}on\s+public\.(orders|payments|purchase_tickets|payment_events|admin_audit_logs)[\s\S]{0,300}with\s+check\s*\(\s*true\s*\)/i.test(allSql)) {
  failures.push("Una tabla sensible contiene una policy de escritura WITH CHECK (true)." );
}

if (/grant\s+execute\s+on\s+function\s+public\.(finalize_paid_order|finalize_refunded_order|create_checkout_order|admin_transition_order)[\s\S]{0,120}\s+to\s+(public|anon|authenticated)/i.test(allSql)) {
  failures.push("Una RPC financiera sensible concede EXECUTE a un rol publico." );
}

const archiveRevokes = ["public", "anon", "authenticated"].every((role) =>
  new RegExp(`revoke\\s+execute\\s+on\\s+function\\s+public\\.archive_assistant_knowledge_version\\(\\)\\s+from\\s+${role}`, "i").test(allSql)
);
if (!archiveRevokes) {
  failures.push("La funcion SECURITY DEFINER del conocimiento no revoca EXECUTE publico." );
}

const searchInsertGrant = lastMatchIndex(/grant\s+(?:insert|all(?:\s+privileges)?)\b[\s\S]{0,100}on\s+(?:table\s+)?public\.search_events[\s\S]{0,100}to\s+(?:anon|authenticated)/g);
const searchAnonRevoke = lastMatchIndex(/revoke\s+all(?:\s+privileges)?\s+on\s+(?:table\s+)?public\.search_events\s+from\s+anon/g);
const searchAuthRevoke = lastMatchIndex(/revoke\s+insert,\s*update,\s*delete(?:,\s*truncate,\s*references,\s*trigger)?\s+on\s+(?:table\s+)?public\.search_events\s+from\s+authenticated/g);
const searchFinalRevoke = Math.min(searchAnonRevoke, searchAuthRevoke);
if (searchAnonRevoke < 0 || searchAuthRevoke < 0 || searchInsertGrant > searchFinalRevoke) {
  failures.push("Los eventos de busqueda conservan un camino de escritura publica." );
}

function lastMatchIndex(pattern) {
  let last = -1;
  for (const match of normalizedSql.matchAll(pattern)) last = match.index ?? last;
  return last;
}

const paymentsSelectGrant = lastMatchIndex(/grant\s+select\s+on\s+(?:table\s+)?public\.payments\s+to\s+authenticated/g);
const paymentsSelectRevoke = lastMatchIndex(/revoke\s+select\s+on\s+(?:table\s+)?public\.payments\s+from\s+authenticated/g);
if (paymentsSelectGrant > paymentsSelectRevoke || paymentsSelectRevoke < 0) {
  failures.push("El estado final de migraciones debe revocar SELECT directo de payments a authenticated.");
}

for (const table of ["payments", "inventory_movements"]) {
  const publicationAdd = lastMatchIndex(new RegExp(`alter\\s+publication\\s+supabase_realtime\\s+add\\s+table\\s+public\\.${table}`, "g"));
  const publicationDrop = lastMatchIndex(new RegExp(`alter\\s+publication\\s+supabase_realtime\\s+drop\\s+table\\s+public\\.${table}`, "g"));
  if (publicationAdd > publicationDrop || publicationDrop < 0) {
    failures.push(`${table}: no debe quedar publicado en Supabase Realtime.`);
  }
}

if (!normalizedSql.includes("private.is_public_catalog_entry")
  || !/revoke\s+all\s+privileges\s+on\s+table\s+public\.product_supplier_sources\s+from\s+anon/i.test(allSql)) {
  failures.push("El estado final no demuestra aislamiento de proveedor, costo y margen del catalogo publico.");
}

const productsTableGrant = lastMatchIndex(/grant\s+select\s+on\s+(?:table\s+)?public\.products\s+to\s+(?:anon|authenticated)/g);
const productsTableRevoke = lastMatchIndex(/revoke\s+select\s+on\s+(?:table\s+)?public\.products\s+from\s+anon,\s*authenticated/g);
if (productsTableGrant > productsTableRevoke || productsTableRevoke < 0) {
  failures.push("products no debe recuperar SELECT de tabla completa para anon/authenticated.");
}

const productColumnHardening = migrations.find(({ file }) => file.includes("hide_internal_product_columns"));
if (!productColumnHardening
  || !/grant\s+select\s*\([\s\S]*availability_status[\s\S]*\)\s+on\s+table\s+public\.products\s+to\s+anon,\s*authenticated/i.test(productColumnHardening.sql)
  || /grant\s+select\s*\([\s\S]*(supplier_id|created_at|updated_at)[\s\S]*\)\s+on\s+table\s+public\.products/i.test(productColumnHardening.sql)) {
  failures.push("El catalogo publico debe usar grants por columna sin supplier_id ni timestamps internos.");
}

for (const table of ["profiles", "addresses", "cart_items", "favorites", "user_preferences"]) {
  const directMutationGrant = lastMatchIndex(new RegExp(
    `grant\\s+(?:insert|update|delete|all(?:\\s+privileges)?)\\b[\\s\\S]{0,80}on\\s+(?:table\\s+)?public\\.${table}[\\s\\S]{0,80}to\\s+authenticated`,
    "g"
  ));
  const mutationRevoke = lastMatchIndex(new RegExp(
    `revoke\\s+insert,\\s*update,\\s*delete\\s+on\\s+(?:table\\s+)?public\\.${table}\\s+from\\s+authenticated`,
    "g"
  ));
  if (directMutationGrant > mutationRevoke) {
    failures.push(`${table}: no debe recuperar mutaciones directas authenticated.`);
  }
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
