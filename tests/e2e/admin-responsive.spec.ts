import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();

async function mountAdminFixture(page: Page, width: number) {
  await page.setViewportSize({ width, height: 860 });
  await page.setContent(`<!doctype html><html><body class="admin-page">
    <main class="admin-app-shell">
      <aside class="admin-sidebar"><nav><a href="#" class="active">Dashboard</a><a href="#">Pedidos</a><a href="#">Eventos de pago</a></nav></aside>
      <section class="admin-workspace">
        <button class="admin-mobile-menu-button" type="button"><span>Menú</span></button>
        <header class="admin-topbar"><div class="admin-topbar__title"><h1>Dashboard</h1><p>Operación diaria</p></div></header>
        <div class="admin-content">
          <section class="admin-task-center"><div class="admin-task-center__grid"><a href="#">Pedidos pendientes <strong>4</strong></a><a href="#">Sin stock <strong>8</strong></a></div></section>
          <section class="admin-panel admin-panel--table">
            <div class="admin-mobile-record-list"><article><button type="button"><strong>FZ-100</strong><dl><div><dt>Estado</dt><dd>Pendiente</dd></div><div><dt>Cliente</dt><dd>Cliente de prueba</dd></div></dl><span>Ver detalle</span></button></article></div>
            <div class="admin-table-wrap admin-table-wrap--responsive"><table class="admin-table"><thead><tr><th>Pedido</th><th>Estado</th><th>Cliente</th></tr></thead><tbody><tr><td>FZ-100</td><td>Pendiente</td><td>Cliente de prueba</td></tr></tbody></table></div>
          </section>
          <section class="admin-panel"><div class="admin-product-table-wrap"><table class="admin-table"><thead><tr><th>Producto</th><th>Stock</th><th>Acciones</th></tr></thead><tbody><tr><td data-label="Producto">Placa de prueba</td><td data-label="Stock">Sin stock</td><td data-label="Acciones"><div class="admin-actions"><button class="btn btn--ghost">Editar</button><button class="btn btn--ghost admin-product-deactivate">Desactivar</button></div></td></tr></tbody></table></div></section>
          <section class="admin-panel"><div class="admin-table-wrap"><table class="admin-table admin-users-table"><thead><tr><th>Cliente</th><th>Email</th><th>Estado</th></tr></thead><tbody><tr><td data-label="Cliente">Cliente de prueba</td><td data-label="Email">cliente@example.com</td><td data-label="Estado">Sin compras</td></tr></tbody></table></div></section>
          <div class="admin-empty-state admin-empty-state--actionable"><span>No hay resultados para los filtros aplicados.</span><button class="btn btn--ghost">Limpiar filtros</button></div>
        </div>
      </section>
    </main>
  </body></html>`);
  await page.addStyleTag({ content: "*{box-sizing:border-box}html,body{width:100%;margin:0;overflow-x:clip}button,input,select,textarea{font:inherit}" });
  for (const file of ["styles/tokens.css", "styles/admin.css", "styles/mobile.css"]) {
    await page.addStyleTag({ content: await fs.readFile(path.join(projectRoot, file), "utf8") });
  }
}

async function documentWidth(page: Page) {
  return page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
}

for (const width of [360, 390, 430, 768]) {
  test(`panel administrativo no desborda a ${width}px`, async ({ page }) => {
    await mountAdminFixture(page, width);
    const dimensions = await documentWidth(page);
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport + 2);

    if (width <= 720) {
      await expect(page.locator(".admin-mobile-record-list")).toBeVisible();
      await expect(page.locator(".admin-table-wrap--responsive")).toBeHidden();
      await expect(page.locator(".admin-product-table-wrap tbody tr")).toHaveCSS("display", "grid");
      await expect(page.locator(".admin-users-table tbody tr")).toHaveCSS("display", "grid");
      const actionHeights = await page.locator(".admin-product-table-wrap .admin-actions .btn").evaluateAll((buttons) =>
        buttons.map((button) => button.getBoundingClientRect().height)
      );
      expect(actionHeights.every((height) => height >= 44)).toBe(true);
    } else {
      await expect(page.locator(".admin-table-wrap--responsive")).toBeVisible();
      await expect(page.locator(".admin-mobile-record-list")).toBeHidden();
    }
  });
}

test("los estados vacíos ofrecen recuperación visible", async ({ page }) => {
  await mountAdminFixture(page, 390);
  const emptyState = page.locator(".admin-empty-state--actionable");
  await expect(emptyState).toContainText("No hay resultados");
  await expect(emptyState.getByRole("button", { name: "Limpiar filtros" })).toBeVisible();
});

test("las rutas administrativas siguen rechazando sesiones anónimas", async ({ page }) => {
  const routes = ["/admin", "/admin/productos", "/admin/pedidos", "/admin/pagos", "/admin/pagos/eventos"];
  for (const route of routes) {
    const response = await page.goto(route, { waitUntil: "domcontentloaded" });
    expect(response?.status(), `${route} debe resolver sin error de servidor`).toBeLessThan(500);
    await expect(page, `${route} debe terminar en login`).toHaveURL(/\/login\?next=/);
  }
});
