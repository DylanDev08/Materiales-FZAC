import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import {
  getCatalogProfitabilityReport,
  type ProfitabilityReportPeriod,
  type ProfitabilityReportScope
} from "@/lib/analytics/catalog-profitability-report";
import { ProfitabilityReportActions } from "@/components/admin/profitability-report-actions";
import { currency } from "@/lib/formatters/currency";
import { getAdminConsolePath } from "@/lib/utils/env";

const periodLabels: Record<ProfitabilityReportPeriod, string> = {
  day: "Hoy",
  week: "Semana",
  month: "Mes"
};

const scopeLabels: Record<ProfitabilityReportScope, string> = {
  all: "Catálogo completo",
  sold: "Vendidos en el período",
  issues: "Requieren revisión"
};

function normalizePeriod(value: string | undefined): ProfitabilityReportPeriod {
  return value === "day" || value === "week" || value === "month" ? value : "month";
}

function normalizeScope(value: string | undefined): ProfitabilityReportScope {
  return value === "all" || value === "sold" || value === "issues" ? value : "all";
}

function percent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}%`;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{ period?: string; scope?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const period = normalizePeriod(params.period);
  const scope = normalizeScope(params.scope);
  const report = await getCatalogProfitabilityReport(period, scope);
  const adminPath = getAdminConsolePath();
  const backHref = `${adminPath}/rentabilidad?period=${period}`;

  return (
    <main className="profit-report-page">
      <header className="profit-report-header">
        <div>
          <span className="kicker">FZAC Materiales · Reporte privado</span>
          <h1>Rentabilidad comercial</h1>
          <p>
            Costos de proveedor, precio FZAC, ventas y ganancia estimada.
            Generado {dateLabel(report.generatedAt)}.
          </p>
        </div>
        <ProfitabilityReportActions backHref={backHref} />
      </header>

      <nav className="profit-report-filters no-print" aria-label="Filtros del reporte">
        {(Object.keys(periodLabels) as ProfitabilityReportPeriod[]).map((value) => (
          <Link
            className={value === period ? "is-active" : ""}
            href={`${adminPath}/rentabilidad/reporte?period=${value}&scope=${scope}`}
            key={value}
          >
            {periodLabels[value]}
          </Link>
        ))}
        <span aria-hidden="true" />
        {(Object.keys(scopeLabels) as ProfitabilityReportScope[]).map((value) => (
          <Link
            className={value === scope ? "is-active" : ""}
            href={`${adminPath}/rentabilidad/reporte?period=${period}&scope=${value}`}
            key={value}
          >
            {scopeLabels[value]}
          </Link>
        ))}
      </nav>

      {!report.available ? (
        <p className="notice notice--danger">No pudimos leer los datos necesarios para generar el reporte.</p>
      ) : null}

      <section className="profit-report-summary" aria-label="Resumen">
        <article><span>Productos activos</span><strong>{report.totalProducts}</strong></article>
        <article><span>Con costo proveedor</span><strong>{report.productsWithSupplierCost}</strong></article>
        <article><span>Sin costo proveedor</span><strong>{report.productsWithoutSupplierCost}</strong></article>
        <article><span>Sin imagen</span><strong>{report.productsWithoutImage}</strong></article>
        <article><span>Unidades vendidas</span><strong>{report.unitsSold}</strong></article>
        <article><span>Ventas del período</span><strong>{currency(report.salesRevenue)}</strong></article>
        <article><span>Ventas con costo</span><strong>{currency(report.coveredSalesRevenue)}</strong></article>
        <article><span>Cobertura de costo</span><strong>{percent(report.coveragePercent)}</strong></article>
        <article><span>Costo estimado vendido</span><strong>{currency(report.estimatedSupplierCostForSales)}</strong></article>
        <article><span>Comisiones de pago</span><strong>{currency(report.paymentProviderFees)}</strong></article>
        <article><span>Ganancia bruta estimada</span><strong>{currency(report.estimatedGrossProfit)}</strong></article>
        <article><span>Después de comisiones</span><strong>{currency(report.estimatedContributionAfterFees)}</strong></article>
      </section>

      <section className="profit-report-context">
        <strong>{scopeLabels[scope]}</strong>
        <span>Período: {periodLabels[period]}</span>
        <span>Desde: {dateLabel(report.periodStart)}</span>
        <span>{report.rows.length} filas</span>
      </section>

      <div className="profit-report-table-wrap">
        <table className="profit-report-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Proveedor</th>
              <th>Costo proveedor</th>
              <th>Origen costo</th>
              <th>Precio FZAC</th>
              <th>Ganancia/u.</th>
              <th>Margen config.</th>
              <th>Markup real</th>
              <th>Stock</th>
              <th>Cant. vendida</th>
              <th>Ventas</th>
              <th>Ganancia estimada</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.productId}>
                <td><strong>{row.name}</strong><small>{row.sku}</small></td>
                <td>{row.supplierName ?? row.supplierSource ?? "Sin proveedor"}</td>
                <td>
                  {row.supplierPrice === null ? (
                    <span className="profit-report-cost-missing">
                      <strong>Sin costo</strong>
                      <Link className="profit-report-cost-action no-print" href={`${adminPath}/compras?product=${row.productId}`}>
                        Cargar costo
                      </Link>
                    </span>
                  ) : currency(row.supplierPrice)}
                </td>
                <td>{row.costSource === "PURCHASE" ? "Compra real" : row.costSource === "SUPPLIER_SOURCE" ? "Fuente proveedor" : "Sin costo"}</td>
                <td>{currency(row.ecommercePrice)}</td>
                <td>{row.unitGrossProfit === null ? "-" : currency(row.unitGrossProfit)}</td>
                <td>{percent(row.configuredMarginPercent)}</td>
                <td>{percent(row.markupPercent)}</td>
                <td>{row.stock}</td>
                <td>{row.unitsSold}</td>
                <td>{currency(row.salesRevenue)}</td>
                <td>{row.estimatedGrossProfit === null ? "-" : currency(row.estimatedGrossProfit)}</td>
                <td>
                  {!row.hasImage ? "Sin imagen" : row.supplierPrice === null ? "Cargar costo" : (row.unitGrossProfit ?? 0) <= 0 ? "Sin margen" : "OK"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="profit-report-footer">
        <strong>Uso interno FZAC</strong>
        <p>
          El costo prioriza el último costo real registrado en compras. Si no existe una compra, usa el precio de fuente del proveedor como referencia.
          La ganancia estimada sólo incluye ventas con algún costo disponible. Las ventas sin costo quedan fuera del cálculo para evitar sobreestimaciones. Las comisiones del proveedor de pagos se descuentan cuando el
          pago las informa. No reemplaza cierre contable ni contempla impuestos u otros gastos no cargados.
        </p>
      </footer>
    </main>
  );
}
