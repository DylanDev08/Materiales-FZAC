import Link from "next/link";
import type { CSSProperties } from "react";
import { Activity, ArrowRight, BarChart3, CreditCard, FileText, Home, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";
import { isMercadoPagoConfigured, isMercadoPagoTestMode } from "@/lib/payments/config";
import { getAdminConsolePath } from "@/lib/utils/env";

type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

function getMetric(metrics: DashboardMetric[], label: string): DashboardMetric {
  return metrics.find((metric) => metric.label === label) ?? { label, value: "0", helper: "Sin datos cargados" };
}

function numericMetric(metrics: DashboardMetric[], label: string) {
  const metric = getMetric(metrics, label);
  const parsed = Number(String(metric.value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function AdminDashboard() {
  const data = await getAdminDashboardData();
  const adminPath = getAdminConsolePath();
  const paymentsReady = isMercadoPagoConfigured();
  const paymentsTestMode = isMercadoPagoTestMode();
  const mainMetrics = [
    getMetric(data.metrics, "Ventas del dia"),
    getMetric(data.metrics, "Ventas del mes"),
    getMetric(data.metrics, "Pedidos pendientes"),
    getMetric(data.metrics, "Aprobacion admin")
  ];
  const graphSource = data.statusCounts.length
    ? data.statusCounts
    : [
        { status: "Pendientes", count: numericMetric(data.metrics, "Pedidos pendientes") },
        { status: "Aprobacion admin", count: numericMetric(data.metrics, "Aprobacion admin") },
        { status: "Pagos pendientes", count: numericMetric(data.metrics, "Pagos pendientes") },
        { status: "Chats", count: numericMetric(data.metrics, "Chats pendientes") }
      ].filter((item) => item.count > 0);
  const graphBars = graphSource.length ? graphSource : [{ status: "Sin pedidos pendientes", count: 1 }];
  const graphMax = Math.max(...graphBars.map((item) => item.count), 1);
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
  ].slice(0, 4);
  const sectionLinks = [
    { href: `${adminPath}/pedidos`, label: "Pedidos", helper: "Compras, aprobaciones y estados", icon: ShoppingBag },
    { href: `${adminPath}/pagos`, label: "Pagos", helper: "Cobros, preferencias y proveedor", icon: CreditCard },
    { href: `${adminPath}/productos`, label: "Productos", helper: "Stock, precios e imagenes", icon: Package },
    { href: `${adminPath}/clientes`, label: "Clientes", helper: "Usuarios, compras y actividad", icon: Users },
    { href: `${adminPath}/tickets`, label: "Tickets", helper: "Comprobantes emitidos", icon: FileText },
    { href: `${adminPath}/logs`, label: "Logs", helper: "Eventos importantes del sistema", icon: Activity }
  ];

  return (
    <AdminShell title="Dashboard">
      <section className={`admin-payment-status ${paymentsReady ? (paymentsTestMode ? "admin-payment-status--test" : "admin-payment-status--ready") : ""}`}>
        <div>
          <strong>{paymentsReady ? (paymentsTestMode ? "Mercado Pago en modo prueba" : "Mercado Pago listo") : "Pagos pendientes de configurar"}</strong>
          <span>
            {paymentsReady
              ? paymentsTestMode
                ? "Para probar, crea una compra y entra al checkout de Mercado Pago con el comprador sandbox."
                : "Credenciales productivas activas. Verifica webhook publico antes de recibir ventas reales."
              : "El panel queda operativo, pero el checkout online necesita credenciales validas para cobrar."}
          </span>
        </div>
      </section>

      <section className="admin-command-center" aria-label="Centro de control FZAC">
        <div className="admin-live-chart admin-panel">
          <header>
            <div>
              <span className="kicker">Movimiento general</span>
              <h2>Estado operativo</h2>
              <p>El grafico resume pedidos y puntos de atencion para entrar directo a cada seccion.</p>
            </div>
            <BarChart3 size={28} />
          </header>

          <div className="admin-live-chart__bars">
            {graphBars.map((item, index) => {
              const height = Math.max(16, Math.round((item.count / graphMax) * 100));
              const style = {
                "--bar-height": `${height}%`,
                "--bar-delay": `${index * 90}ms`
              } as CSSProperties;

              return (
                <article key={item.status} style={style}>
                  <span>{item.count}</span>
                  <i />
                  <strong>{item.status}</strong>
                </article>
              );
            })}
          </div>

          <div className="admin-live-chart__metrics">
            {mainMetrics.map((metric) => (
              <article key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.helper}</small>
              </article>
            ))}
          </div>
        </div>

        <aside className="admin-log-highlight admin-panel">
          <header>
            <div>
              <span className="kicker">Prioridad</span>
              <h2>Logs destacados</h2>
            </div>
            <Link href={`${adminPath}/logs`}>
              Ver logs <ArrowRight size={16} />
            </Link>
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
              <p className="admin-help">Sin logs criticos recientes.</p>
            )}
          </div>
        </aside>
      </section>

      <section className="admin-section-grid" aria-label="Secciones administrativas">
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
