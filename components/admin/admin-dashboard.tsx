import Link from "next/link";
import type { CSSProperties } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CreditCard,
  FileText,
  Home,
  Package,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Users
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";
import { isMercadoPagoConfigured, isMercadoPagoTestMode } from "@/lib/payments/config";
import { getAdminConsolePath } from "@/lib/utils/env";

type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

type DashboardSeries = {
  label: string;
  values: number[];
  color: string;
};

function getMetric(metrics: DashboardMetric[], label: string): DashboardMetric {
  return metrics.find((metric) => metric.label === label) ?? { label, value: "0", helper: "Sin datos cargados" };
}

function numericMetric(metrics: DashboardMetric[], label: string) {
  const metric = getMetric(metrics, label);
  const parsed = Number(String(metric.value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.round((value / total) * 100));
}

function sparklinePoints(values: number[], width = 420, height = 152) {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - (value / max) * (height - 16) - 8);
      return `${x},${y}`;
    })
    .join(" ");
}

function DashboardLineChart({
  title,
  helper,
  labels,
  series
}: {
  title: string;
  helper: string;
  labels: string[];
  series: DashboardSeries[];
}) {
  return (
    <article className="admin-analytics-chart">
      <header>
        <div>
          <span className="kicker">Grafico</span>
          <h3>{title}</h3>
          <p>{helper}</p>
        </div>
        <BarChart3 size={22} />
      </header>
      <svg viewBox="0 0 420 170" role="img" aria-label={title}>
        <rect x="0" y="0" width="420" height="170" rx="10" fill="rgba(244,196,0,0.045)" />
        {[38, 76, 114, 152].map((y) => (
          <line key={y} x1="0" x2="420" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
        ))}
        {series.map((item) => (
          <polyline
            fill="none"
            key={item.label}
            points={sparklinePoints(item.values)}
            stroke={item.color}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
        ))}
      </svg>
      <div className="admin-analytics-chart__legend">
        {series.map((item) => (
          <span key={item.label}>
            <i style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div className="admin-analytics-chart__axis">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </article>
  );
}

export async function AdminDashboard() {
  const data = await getAdminDashboardData();
  const adminPath = getAdminConsolePath();
  const paymentsReady = isMercadoPagoConfigured();
  const paymentsTestMode = isMercadoPagoTestMode();
  const salesToday = getMetric(data.metrics, "Ventas del dia");
  const salesMonth = getMetric(data.metrics, "Ventas del mes");
  const pendingOrders = getMetric(data.metrics, "Pedidos pendientes");
  const adminApproval = getMetric(data.metrics, "Aprobacion admin");
  const paidOrders = getMetric(data.metrics, "Pedidos pagados");
  const pendingPayments = getMetric(data.metrics, "Pagos pendientes");
  const approvedPayments = getMetric(data.metrics, "Pagos aprobados");
  const rejectedPayments = getMetric(data.metrics, "Pagos rechazados");
  const averageTicket = getMetric(data.metrics, "Ticket promedio");
  const newCustomers = getMetric(data.metrics, "Clientes nuevos");
  const activeProducts = getMetric(data.metrics, "Productos activos");
  const noStock = getMetric(data.metrics, "Productos sin stock");
  const pendingTotal = getMetric(data.metrics, "Total pendiente");
  const tickets = getMetric(data.metrics, "Tickets emitidos");

  const plainMetrics = [
    { label: "Ingresos del mes", value: salesMonth.value, helper: `${salesToday.value} registrado hoy` },
    { label: "Pedidos pendientes", value: pendingOrders.value, helper: `${adminApproval.value} requiere aprobacion` },
    { label: "Pagos pendientes", value: pendingPayments.value, helper: `${rejectedPayments.value} pagos denegados` },
    { label: "Pedidos pagados", value: paidOrders.value, helper: `${approvedPayments.value} pagos aprobados` },
    { label: "Comprobantes de pago", value: tickets.value, helper: "Facturas y tickets emitidos" },
    { label: "Clientes nuevos", value: newCustomers.value, helper: `${activeProducts.value} productos activos` },
    { label: "Ticket promedio", value: averageTicket.value, helper: "Promedio por compra aprobada" },
    { label: "Total pendiente", value: pendingTotal.value, helper: `${noStock.value} productos sin stock` }
  ];

  const statusSource = data.statusCounts.length
    ? data.statusCounts
    : [
        { status: "Pago pendiente", count: numericMetric(data.metrics, "Pedidos pendientes") },
        { status: "Requiere revision", count: numericMetric(data.metrics, "Aprobacion admin") },
        { status: "Pagos pendientes", count: numericMetric(data.metrics, "Pagos pendientes") },
        { status: "Chats pendientes", count: numericMetric(data.metrics, "Chats pendientes") }
      ].filter((item) => item.count > 0);
  const statusTotal = statusSource.reduce((sum, item) => sum + item.count, 0);
  const statusColors = ["#16834a", "#f4c400", "#1c7ed6", "#b42318", "#7c3aed", "#f97316"];
  const logHighlights = [
    ...(data.recentPaymentEvents ?? []).map((event) => ({
      title: event.Estado,
      detail: event.Error !== "-" ? event.Error : event.Evento,
      date: event.Fecha
    })),
    ...(data.recentInventory ?? []).map((movement) => ({
      title: `Stock - ${movement.Tipo}`,
      detail: `${movement.Motivo} (${movement.Cantidad})`,
      date: movement.Fecha
    }))
  ].slice(0, 5);

  const commercialSeries = [
    numericMetric(data.metrics, "Clientes nuevos"),
    numericMetric(data.metrics, "Pedidos pendientes"),
    numericMetric(data.metrics, "Pedidos pagados"),
    numericMetric(data.metrics, "Pagos aprobados"),
    numericMetric(data.metrics, "Tickets emitidos")
  ];
  const sectionLinks = [
    { href: `${adminPath}/pedidos`, label: "Pedidos", helper: "Compras, aprobaciones y estados", icon: ShoppingBag },
    { href: `${adminPath}/pagos`, label: "Pagos", helper: "Cobros, transferencias y proveedor", icon: CreditCard },
    { href: `${adminPath}/productos`, label: "Productos", helper: "Stock, precios e imagenes", icon: Package },
    { href: `${adminPath}/clientes`, label: "Clientes", helper: "Usuarios, compras y actividad", icon: Users },
    { href: `${adminPath}/tickets`, label: "Tickets", helper: "Comprobantes emitidos", icon: FileText },
    { href: `${adminPath}/logs`, label: "Actividad", helper: "Alertas importantes del sistema", icon: Activity }
  ];

  return (
    <AdminShell title="Dashboard">
      <section className={`admin-payment-status ${paymentsReady ? (paymentsTestMode ? "admin-payment-status--test" : "admin-payment-status--ready") : ""}`}>
        <div>
          <strong>{paymentsReady ? (paymentsTestMode ? "Mercado Pago en modo prueba" : "Mercado Pago listo") : "Pagos pendientes de configurar"}</strong>
          <span>
            {paymentsReady
              ? paymentsTestMode
                ? "Usa compradores sandbox para probar checkout, retorno y comprobantes sin cobrar dinero real."
                : "Credenciales productivas activas. Verifica webhook publico antes de recibir ventas reales."
              : "El panel queda operativo, pero el checkout online necesita credenciales validas para cobrar."}
          </span>
        </div>
      </section>

      <section className="admin-simple-dashboard" aria-label="Metricas del e-commerce FZAC">
        <header className="admin-simple-head">
          <div>
            <span className="kicker">Panel principal</span>
            <h2>Lo importante para atender hoy</h2>
            <p>Una vista simple para revisar ventas, pagos, stock y avisos sin entrar perdido al sistema.</p>
          </div>
          <Link className="btn btn--ghost" href={`${adminPath}/logs`}>
            Ver actividad <ArrowRight size={17} />
          </Link>
        </header>

        <div className="admin-simple-grid admin-simple-grid--metrics-first">
          <section className="admin-simple-panel admin-simple-panel--main admin-simple-panel--metrics">
            <header className="admin-simple-panel__head">
              <div>
                <span className="kicker">Operaciones</span>
                <h3>Como vienen las ventas</h3>
                <p>La barra muestra donde se concentran pedidos, pagos y tareas pendientes.</p>
              </div>
              <TrendingUp size={22} />
            </header>

            <section className="admin-status-overview admin-status-overview--flat" aria-label="Estados de venta">
              <header>
                <div>
                  <span className="kicker">Estados</span>
                  <h3>Estado general</h3>
                </div>
                <strong>{statusTotal} registros</strong>
              </header>
              <div className="admin-status-stack">
                {statusSource.length ? (
                  statusSource.map((item, index) => {
                    const style = {
                      "--segment-width": `${Math.max(5, percent(item.count, statusTotal))}%`,
                      "--segment-color": statusColors[index % statusColors.length]
                    } as CSSProperties;
                    return <span key={`${item.status}-${index}`} style={style} title={`${item.status}: ${item.count}`} />;
                  })
                ) : (
                  <span style={{ "--segment-width": "100%", "--segment-color": "#f4c400" } as CSSProperties} />
                )}
              </div>
              <div className="admin-status-legend">
                {(statusSource.length ? statusSource : [{ status: "Sin operaciones pendientes", count: 0 }]).map((item, index) => (
                  <span key={`${item.status}-legend`}>
                    <i style={{ background: statusColors[index % statusColors.length] }} />
                    {item.status} <strong>{item.count}</strong>
                  </span>
                ))}
              </div>
            </section>

            <DashboardLineChart
              title="Movimiento comercial"
              helper="Clientes, pedidos, pagos y comprobantes en una sola lectura."
              labels={["Clientes", "Pendientes", "Pagados", "Pagos", "Tickets"]}
              series={[{ label: "E-Commerce", values: commercialSeries, color: "#f4c400" }]}
            />
          </section>

          <aside className="admin-simple-panel admin-simple-panel--numbers">
            <header className="admin-simple-panel__head">
              <div>
                <span className="kicker">Resumen facil</span>
                <h3>Numeros que importan</h3>
                <p>Valores utiles para decidir sin mirar datos tecnicos.</p>
              </div>
              <BarChart3 size={22} />
            </header>
            <div className="admin-plain-metrics admin-plain-metrics--dashboard">
              {plainMetrics.map((metric) => (
                <article key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.helper}</small>
                </article>
              ))}
            </div>
          </aside>
        </div>

        <section className="admin-simple-panel admin-log-highlight">
          <header>
            <div>
              <span className="kicker">Avisos</span>
              <h2>Actividad destacada</h2>
              <p>Lo ultimo que conviene revisar antes de preparar pedidos.</p>
            </div>
            <ShieldCheck size={22} />
          </header>
          <div className="admin-mini-list">
            {logHighlights.length ? (
              logHighlights.map((item, index) => (
                <article key={`${item.title}-${index}`}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                  <small>{item.date}</small>
                </article>
              ))
            ) : (
              <p className="admin-help">Sin avisos criticos recientes.</p>
            )}
          </div>
        </section>
      </section>

      <section className="admin-section-grid" aria-label="Secciones administrativas">
        <header className="admin-section-grid__head">
          <div>
            <span className="kicker">Gestion</span>
            <h2>Entrar a una seccion</h2>
            <p>Accesos separados para que cada tarea tenga su lugar.</p>
          </div>
        </header>
        {sectionLinks.map(({ href, label, helper, icon: Icon }) => (
          <Link href={href} key={href}>
            <Icon size={20} />
            <span>
              <strong>{label}</strong>
              <small>{helper}</small>
            </span>
            <ArrowRight size={16} />
          </Link>
        ))}
        <Link href="/productos">
          <Home size={20} />
          <span>
            <strong>Vista cliente</strong>
            <small>Ver la tienda como comprador</small>
          </span>
          <ArrowRight size={16} />
        </Link>
      </section>
    </AdminShell>
  );
}
