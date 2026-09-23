import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function importTypeScriptModule(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const { buildAdminAttentionTasks, numericDashboardMetric } = await importTypeScriptModule("../../lib/admin/dashboard-attention.ts");
const { filterAdminRows, paginateAdminRows, parseAdminDate } = await importTypeScriptModule("../../lib/admin/table-view.ts");

const rows = [
  { Pedido: "FZ-100", Cliente: "Ana Gómez", Estado: "Pendiente", Fecha: "22/09/2026 10:15" },
  { Pedido: "FZ-101", Cliente: "Bruno Díaz", Estado: "Pagado", Fecha: "23/09/2026 11:30" },
  { Pedido: "FZ-102", Cliente: "Carla Ruiz", Estado: "Pendiente", Fecha: "24/09/2026 09:00" }
];

test("la búsqueda y los filtros administrativos se combinan sin perder columnas", () => {
  assert.deepEqual(
    filterAdminRows(rows, {
      columns: ["Pedido", "Cliente", "Estado", "Fecha"],
      query: "gómez",
      statusColumn: "Estado",
      status: "Pendiente"
    }).map((row) => row.Pedido),
    ["FZ-100"]
  );

  assert.deepEqual(
    filterAdminRows(rows, {
      columns: ["Pedido", "Cliente", "Estado", "Fecha"],
      query: "",
      dateColumn: "Fecha",
      dateFrom: "2026-09-23",
      dateTo: "2026-09-24"
    }).map((row) => row.Pedido),
    ["FZ-101", "FZ-102"]
  );
});

test("las fechas administrativas y las páginas inválidas se normalizan", () => {
  assert.equal(parseAdminDate("2/9/2026 08:00"), "2026-09-02");
  assert.equal(parseAdminDate("sin fecha"), null);

  const page = paginateAdminRows(rows, 99, 2);
  assert.equal(page.currentPage, 2);
  assert.equal(page.totalPages, 2);
  assert.deepEqual(page.rows.map((row) => row.Pedido), ["FZ-102"]);
});

test("el dashboard prioriza atención real sin métricas inventadas", () => {
  const metrics = [
    { label: "Pedidos pendientes", value: "4", helper: "" },
    { label: "Pagos pendientes", value: "2", helper: "" },
    { label: "Pagos rechazados", value: "1", helper: "" },
    { label: "Productos sin stock", value: "8", helper: "" },
    { label: "Productos bajo stock", value: "12", helper: "" },
    { label: "Cuentas vencidas", value: "3", helper: "" },
    { label: "Chats pendientes", value: "5", helper: "" }
  ];
  const tasks = buildAdminAttentionTasks(metrics, true);

  assert.equal(tasks.find((task) => task.key === "pending-orders")?.value, 4);
  assert.equal(tasks.find((task) => task.key === "rejected-payments")?.value, 1);
  assert.equal(tasks.find((task) => task.key === "out-of-stock")?.value, 8);
  assert.equal(tasks.find((task) => task.key === "low-stock")?.value, 12);
  assert.equal(tasks.find((task) => task.key === "system")?.value, 0);
  assert.equal(tasks.length, 8);
  assert.equal(numericDashboardMetric(metrics, "Métrica inexistente"), 0);
});

test("el dashboard muestra una alerta de sistema solo cuando la configuración real no está lista", () => {
  const ready = buildAdminAttentionTasks([], true);
  const blocked = buildAdminAttentionTasks([], false);

  assert.equal(ready.every((task) => task.value === 0), true);
  assert.equal(blocked.find((task) => task.key === "system")?.value, 1);
});
