import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const sidebar = read("../../components/admin/admin-sidebar.tsx");
const dashboard = read("../../components/admin/admin-dashboard.tsx");
const layout = read("../../app/admin/layout.tsx");

test("daily admin navigation stays small and operational", () => {
  const primary = sidebar.split("const primaryLinks = [")[1]?.split("];")[0] ?? "";
  assert.equal((primary.match(/path:/g) ?? []).length, 7);
  for (const path of ['"/pedidos"', '"/productos"', '"/inventario"', '"/clientes"', '"/proveedores"', '"/chats"']) {
    assert.ok(primary.includes(path), `Missing daily operation ${path}`);
  }
});

test("advanced tools remain accessible without cluttering first view", () => {
  assert.match(sidebar, /const additionalLinks = \[/);
  for (const path of ['"/pagos"', '"/finanzas"', '"/auditoria-precios"', '"/sistema"', '"/reportes"']) {
    assert.ok(sidebar.includes(path), `Hidden route was removed: ${path}`);
  }
  assert.match(sidebar, /aria-expanded=\{showMore\}/);
  assert.match(sidebar, /showMore \? \(/);
});

test("dashboard prioritizes storefront operations, not unused gateway metrics", () => {
  assert.match(dashboard, /Resumen de la tienda/);
  assert.match(dashboard, /Últimos pedidos/);
  assert.match(dashboard, /transferencia y WhatsApp/);
  assert.doesNotMatch(dashboard, /getDashboardPaymentState|AdminModelLineChart|Mercado Pago requiere revisión/);
});

test("admin authorization is still required on server layout", () => {
  assert.match(layout, /await requireAdmin\(\)/);
});

const productsManager = read("../../components/admin/admin-products-manager.tsx");

test("product editor opens in an accessible dialog without changing its create and edit APIs", () => {
  assert.match(productsManager, /admin-product-dialog-backdrop/);
  assert.match(productsManager, /role=\{mode === "full" \? "dialog"/);
  assert.match(productsManager, /aria-modal=\{mode === "full" \? true/);
  assert.match(productsManager, /aria-labelledby="admin-product-editor-title"/);
  assert.match(productsManager, /method: form\.id \? "PATCH" : "POST"/);
  assert.match(productsManager, /\/api\/admin\/products/);
});

test("deactivation requires an explicit confirmation and keeps historical records", () => {
  assert.match(productsManager, /role="alertdialog"/);
  assert.match(productsManager, /setPendingDeactivation\(product\)/);
  assert.match(productsManager, /disabled=\{deactivating\}/);
  assert.match(productsManager, /method: "DELETE"/);
  assert.match(productsManager, /active: false/);
});

test("only common catalog filters are shown by default", () => {
  assert.match(productsManager, /<details className="admin-catalog-extra-filters">/);
  assert.match(productsManager, /<summary>Más filtros<\/summary>/);
  for (const label of ["Categoría", "Marca", "Proveedor"]) {
    assert.ok(productsManager.includes(`<span>${label}</span>`));
  }
});

const ordersView = read("../../components/admin/admin-orders-view.tsx");
const paymentConfirmation = read("../../components/admin/admin-payment-confirmation.tsx");
const adminData = read("../../lib/db/admin.ts");
const contact = read("../../lib/utils/contact.ts");

test("admin order screen prioritizes approvals and WhatsApp coordination", () => {
  assert.match(ordersView, /Pedidos de la tienda/);
  assert.match(ordersView, /Por aprobar/);
  assert.match(ordersView, /Para coordinar/);
  assert.match(ordersView, /admin-orders-fulfillment-group/);
  assert.match(ordersView, /<AdminInteractiveTable title="Pedidos"/);
  const approval = ordersView.indexOf('{approvalRows.length ?');
  const coordinate = ordersView.indexOf('{coordinateRows.length ?');
  const fulfillment = ordersView.indexOf('{fulfillmentRows.length ?');
  assert.ok(approval >= 0 && approval < coordinate && coordinate < fulfillment);
});

test("customer contact never falls back to the storefront WhatsApp number", () => {
  assert.match(contact, /export function getCustomerWhatsAppHref/);
  assert.match(contact, /if \(!local \|\| local\.length !== 10\) return null/);
  assert.doesNotMatch(ordersView, /getWhatsAppHref\(/);
  assert.doesNotMatch(paymentConfirmation, /getWhatsAppHref\(/);
  assert.match(ordersView, /getCustomerWhatsAppHref\(row\.Telefono, message\)/);
  assert.match(paymentConfirmation, /getCustomerWhatsAppHref\(row\.Telefono,/);
});

test("transfer confirmation receives provider from order formatting", () => {
  assert.match(adminData, /__paymentProvider: String\(payment\?\.provider \?\? ""\)/);
  assert.match(paymentConfirmation, /provider === "BANK_TRANSFER"/);
  assert.match(paymentConfirmation, /status === "PENDING_TRANSFER"/);
  assert.match(paymentConfirmation, /!proofMediaId/);
});

const customersView = read("../../components/admin/admin-customers-view.tsx");
const stockPage = read("../../app/admin/inventario/page.tsx");

test("customers screen starts with a simple list and no automatically opened customer", () => {
  assert.match(customersView, /useState<CustomerRow \| null>\(null\)/);
  assert.match(customersView, /<h2>Clientes<\/h2>/);
  assert.match(customersView, /<summary>Más filtros<\/summary>/);
  assert.match(customersView, /\["Cliente", "Email", "Teléfono", "Pedidos", "Total gastado", "Acción"\]/);
  assert.match(customersView, /getCustomerWhatsAppHref\(row\.Telefono,/);
  assert.doesNotMatch(customersView, /getWhatsAppHref\(/);
});

test("stock screen prioritizes product availability and retains internal stock tools", () => {
  assert.match(stockPage, /Gestión diaria/);
  assert.match(stockPage, /Ir a productos/);
  assert.match(stockPage, /Stock por depósito y movimientos internos/);
  assert.match(stockPage, /<AdminInventoryLocations/);
  assert.match(stockPage, /<AdminInventoryForecast/);
  assert.match(stockPage, /await requireAdmin\(\)/);
});

test("admin actions recover safely after request failures", () => {
  assert.match(ordersView, /Falló la conexión\. Verificá el estado del pedido/);
  assert.match(ordersView, /No se pudo conectar\. No sabemos si el cambio se guardó/);
  assert.match(ordersView, /finally \{\s*setBusy\(null\)/);
  assert.match(ordersView, /finally \{\s*setSaving\(false\)/);
  assert.match(paymentConfirmation, /No se pudo verificar la confirmación/);
  assert.match(paymentConfirmation, /finally \{\s*setBusy\(null\)/);
});

test("product editor keeps errors visible inside deactivation confirmation", () => {
  assert.match(productsManager, /admin-product-confirm__actions/);
  assert.match(productsManager, /className="notice notice--danger" role="alert"/);
  assert.match(productsManager, /if \(deactivating\) return/);
});
