import Link from "next/link";
import { AlertTriangle, BadgeDollarSign, CircleDollarSign, Gauge, ReceiptText } from "lucide-react";
import { currency } from "@/lib/formatters/currency";
import type { ProfitabilityOverview, ProfitabilityPeriod } from "@/lib/analytics/profitability";
import { getAdminConsolePath } from "@/lib/utils/env";

const periodLabels: Record<ProfitabilityPeriod, string> = { day: "Hoy", week: "Semana", month: "Mes" };

function percent(value: number) {
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function AdminProfitability({ data }: { data: ProfitabilityOverview }) {
  const adminPath = getAdminConsolePath();
  const metrics = [
    { label: "Ventas de productos", value: currency(data.productRevenue), helper: `${data.paidOrders} pedidos pagados`, icon: CircleDollarSign },
    { label: "Margen bruto estimado", value: currency(data.estimatedGrossMargin), helper: `${percent(data.coveragePercent)} con costo`, icon: BadgeDollarSign },
    { label: "Gastos operativos", value: currency(data.operatingExpenses), helper: "Sin duplicar pagos a proveedores", icon: ReceiptText },
    { label: "Contribución estimada", value: currency(data.estimatedContribution), helper: "Margen cubierto menos gastos", icon: Gauge }
  ];

  return (
    <div className="admin-profitability">
      <nav className="admin-profitability__periods" aria-label="Período de rentabilidad">
        {(Object.keys(periodLabels) as ProfitabilityPeriod[]).map((period) => (
          <Link className={period === data.period ? "is-active" : ""} href={`${adminPath}/rentabilidad?period=${period}`} key={period}>
            {periodLabels[period]}
          </Link>
        ))}
      </nav>

      {!data.available ? (
        <div className="notice notice--warning"><AlertTriangle size={18} /> No pudimos leer costos y ventas en este momento.</div>
      ) : null}

      <section className="admin-profitability__metrics" aria-label="Resumen de rentabilidad">
        {metrics.map(({ label, value, helper, icon: Icon }) => (
          <article key={label}><Icon size={19} /><span>{label}</span><strong>{value}</strong><small>{helper}</small></article>
        ))}
      </section>

      <section className="admin-panel admin-profitability__explanation">
        <AlertTriangle size={20} />
        <div>
          <strong>Lectura comercial estimada</strong>
          <p>El costo usa la última compra registrada de cada producto. No modifica pedidos, pagos ni stock y no reemplaza un cierre contable. Los productos sin costo quedan señalados en lugar de asumir un valor.</p>
        </div>
      </section>

      <section className="admin-panel">
        <header className="admin-panel__head">
          <div><span className="kicker">Productos</span><h2>Margen por producto</h2><p>Primero aparecen los márgenes más bajos para facilitar decisiones.</p></div>
          <span className="status-pill">Cobertura {percent(data.coveragePercent)}</span>
        </header>
        {data.products.length ? (
          <div className="admin-profitability__table-wrap">
            <table className="admin-profitability__table">
              <thead><tr><th>Producto</th><th>Unidades</th><th>Ventas</th><th>Último costo</th><th>Margen estimado</th><th>Estado</th></tr></thead>
              <tbody>
                {data.products.map((product) => (
                  <tr key={product.productId}>
                    <td data-label="Producto"><strong>{product.name}</strong><small>{product.sku}</small></td>
                    <td data-label="Unidades">{product.unitsSold}</td>
                    <td data-label="Ventas">{currency(product.revenue)}</td>
                    <td data-label="Último costo">{product.latestUnitCost === null ? "Sin costo" : currency(product.latestUnitCost)}</td>
                    <td data-label="Margen estimado">{product.estimatedMargin === null ? "-" : `${currency(product.estimatedMargin)} · ${percent(product.estimatedMarginPercent ?? 0)}`}</td>
                    <td data-label="Estado"><span className={`status-pill ${product.estimatedCost === null ? "status-pill--warning" : (product.estimatedMargin ?? 0) < 0 ? "status-pill--danger" : "status-pill--success"}`}>{product.estimatedCost === null ? "Cargar costo" : (product.estimatedMargin ?? 0) < 0 ? "Margen negativo" : "Con costo"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-empty">No hay ventas pagadas en el período seleccionado.</p>}
      </section>
    </div>
  );
}
