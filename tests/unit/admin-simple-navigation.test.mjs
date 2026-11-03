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
