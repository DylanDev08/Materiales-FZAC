import Link from "next/link";
import type { CSSProperties } from "react";
import { CreditCard, PackageCheck, ShoppingBag, TrendingUp } from "lucide-react";
import { AdminDashboardAutoRefresh } from "@/components/admin/admin-dashboard-auto-refresh";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";
import { isMercadoPagoConfigured, isMercadoPagoTestMode } from "@/lib/payments/config";

type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
};

type StatusSegment = {
  label: string;
  value: number;
  color: string;
};

type ChartSeries = {
  label: string;
  values: number[];
  color: string;
};

type DashboardPeriod = "day" | "week" | "month";

const periodOptions: Array<{ value: DashboardPeriod; label: string; helper: string }> = [
  { value: "day", label: "Dia", helper: "Hoy" },
  { value: "week", label: "Semana", helper: "Semana actual" },
  { value: "month", label: "Mes", helper: "Mes actual" }
];

function normalizePeriod(period: string | undefined): DashboardPeriod {
  if (period === "day" || period === "week" || period === "month") return period;
  return "month";
}

function periodLabel(period: DashboardPeriod) {
  return periodOptions.find((option) => option.value === period)?.helper ?? "Mes actual";
}

function getMetric(metrics: DashboardMetric[], label: string): DashboardMetric {
  return metrics.find((metric) => metric.label === label) ?? { label, value: "0", helper: "Sin datos" };
}

function numericMetric(metrics: DashboardMetric[], label: string) {
  const raw = getMetric(metrics, label).value;
  const parsed = Number(String(raw).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function plus(value: string) {
  return value.startsWith("+") ? value : `+${value}`;
}

function segmentWidth(value: number, total: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

function chartPoints(values: number[], width = 520, height = 230) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;

  return values
    .map((value, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - ((value - min) / range) * (height - 30) - 15);
      return `${x},${y}`;
    })
    .join(" ");
}

function DashboardCycleCard({
  title,
  amount,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue,
  caption,
  footer,
  tone,
  icon: Icon
}: {
  title: string;
  amount: string;
  primaryLabel: string;
  primaryValue: string;
  secondaryLabel: string;
  secondaryValue: string;
  caption: string;
  footer: string;
  tone: "yellow" | "green" | "red";
  icon: typeof TrendingUp;
}) {
  return (
    <article className={`admin-model-card admin-model-card--${tone}`}>
      <div className="admin-model-card__top">
        <span>
          <i />
          {title}
        </span>
        <small>24/6 - 24/7</small>
      </div>
      <strong className="admin-model-card__amount">{amount}</strong>
      <p>{caption}</p>
      <div className="admin-model-card__counts">
        <span>
          <strong>{primaryValue}</strong>
          {primaryLabel}
        </span>
        <span>
          <strong>{secondaryValue}</strong>
          {secondaryLabel}
        </span>
      </div>
      <footer>{footer}</footer>
      <Icon className="admin-model-card__icon" size={92} />
      <span className="admin-model-card__watermark">FZAC</span>
    </article>
  );
}

function AdminModelLineChart({ labels, title, series }: { labels: string[]; title: string; series: ChartSeries[] }) {
  return (
    <article className="admin-model-chart">
      <header>
        <h3>{title}</h3>
        <div>
          {series.map((item) => (
            <span key={item.label}>
              <i style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      </header>
      <svg viewBox="0 0 520 250" role="img" aria-label={title}>
        <rect width="520" height="250" rx="8" fill="transparent" />
        {[45, 90, 135, 180, 225].map((y) => (
          <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="rgba(255,255,255,0.08)" />
        ))}
        {[0, 104, 208, 312, 416, 520].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="250" stroke="rgba(255,255,255,0.035)" />
        ))}
        {series.map((item) => (
          <g key={item.label}>
            <polyline
              fill="none"
              points={chartPoints(item.values)}
              stroke={item.color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
            {item.values.map((_, index) => {
              const [x, y] = chartPoints(item.values).split(" ")[index].split(",");
              return <circle cx={x} cy={y} fill={item.color} key={`${item.label}-${index}`} r="5" />;
            })}
          </g>
        ))}
      </svg>
      <div className="admin-model-chart__axis" aria-hidden="true">
        {labels.map((label) => (
          <span key={`${title}-${label}`}>{label}</span>
        ))}
      </div>
    </article>
  );
}

export async function AdminDashboard({ period }: { period?: string }) {
  const selectedPeriod = normalizePeriod(period);
  const data = await getAdminDashboardData(selectedPeriod);
  const metrics = data.metrics;
  const paymentsReady = isMercadoPagoConfigured();
  const paymentsTestMode = isMercadoPagoTestMode();

  const salesToday = getMetric(metrics, "Ventas del dia");
  const salesMonth = getMetric(metrics, "Ventas del mes");
  const periodIncome = getMetric(metrics, "Ingresos del periodo");
  const periodExpenses = getMetric(metrics, "Egresos del periodo");
  const periodBalance = getMetric(metrics, "Balance del periodo");
  const pendingTotal = getMetric(metrics, "Total pendiente");
  const pendingOrders = getMetric(metrics, "Pedidos pendientes");
  const approvalOrders = getMetric(metrics, "Aprobacion admin");
  const pendingPayments = getMetric(metrics, "Pagos pendientes");
  const approvedPayments = getMetric(metrics, "Pagos aprobados");
  const rejectedPayments = getMetric(metrics, "Pagos rechazados");
  const averageTicket = getMetric(metrics, "Ticket promedio");

  const statusSegments: StatusSegment[] = [
    { label: "Concretadas", value: numericMetric(metrics, "Pedidos pagados"), color: "#0f9d66" },
    { label: "Coordinadas", value: numericMetric(metrics, "Aprobacion admin"), color: "#0b84ff" },
    { label: "En proceso", value: numericMetric(metrics, "Pagos pendientes"), color: "#2f6bff" },
    { label: "Pendientes", value: numericMetric(metrics, "Pedidos pendientes"), color: "#274060" },
    { label: "En conflicto", value: numericMetric(metrics, "Pagos rechazados"), color: "#e5533d" },
    { label: "Rechazadas", value: numericMetric(metrics, "Pagos rechazados"), color: "#c2185b" },
    { label: "Proxima zona", value: numericMetric(metrics, "Chats pendientes"), color: "#0057d9" }
  ];
  const statusTotal = statusSegments.reduce((sum, item) => sum + item.value, 0);
  const visibleStatus = statusTotal
    ? statusSegments
    : [{ label: "Sin movimientos", value: 1, color: "#f4c400" }];

  const chartData = data.charts;

  return (
    <AdminShell title="Dashboard" description="Resumen general de ventas, pedidos, pagos y actividad.">
      <section className="admin-dashboard-model" aria-label="Dashboard administrativo FZAC">
        <div className="admin-model-control-row">
          <div className="admin-model-payment-state">
            <span className={paymentsReady ? (paymentsTestMode ? "is-test" : "is-ready") : "is-warning"} />
            {paymentsReady
              ? paymentsTestMode
                ? "Mercado Pago en modo prueba"
                : "Mercado Pago listo"
              : "Mercado Pago pendiente de configurar"}
          </div>
          <AdminDashboardAutoRefresh />
          <nav className="admin-model-period-tabs" aria-label="Periodo de ingresos y egresos">
            <strong>Ingresos / egresos</strong>
            {periodOptions.map((option) => (
              <Link
                aria-current={selectedPeriod === option.value ? "page" : undefined}
                className={selectedPeriod === option.value ? "active" : undefined}
                href={`?period=${option.value}`}
                key={option.value}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="admin-model-cards">
          <DashboardCycleCard
            amount={plus(periodIncome.value)}
            caption={periodLabel(selectedPeriod)}
            footer={periodIncome.helper}
            icon={TrendingUp}
            primaryLabel="balance"
            primaryValue={periodBalance.value}
            secondaryLabel="egresos"
            secondaryValue={periodExpenses.value}
            title="INGRESOS"
            tone="yellow"
          />
          <DashboardCycleCard
            amount={plus(pendingTotal.value)}
            caption="Pendiente de cobrar"
            footer={`${pendingOrders.value} pendientes / ${approvalOrders.value} en revision`}
            icon={ShoppingBag}
            primaryLabel="pendientes"
            primaryValue={pendingOrders.value}
            secondaryLabel="revision"
            secondaryValue={approvalOrders.value}
            title="PEDIDOS"
            tone="green"
          />
          <DashboardCycleCard
            amount={plus(salesToday.value)}
            caption="Cobros y proveedor"
            footer={`${rejectedPayments.value} rechazados / ${pendingPayments.value} pendientes`}
            icon={CreditCard}
            primaryLabel="aprobados"
            primaryValue={approvedPayments.value}
            secondaryLabel="creados"
            secondaryValue={pendingPayments.value}
            title="PAGOS"
            tone="red"
          />
        </div>

        <section className="admin-model-status">
          <header>
            <h2>Estados de las ventas del mes</h2>
            <strong>{statusTotal} ventas</strong>
          </header>
          <div className="admin-model-status__bar" aria-hidden="true">
            {visibleStatus.map((item) => (
              <span
                key={item.label}
                style={
                  {
                    "--status-color": item.color,
                    "--status-width": `${segmentWidth(item.value, statusTotal || 1)}%`
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div className="admin-model-status__legend">
            {statusSegments.map((item) => (
              <span key={item.label}>
                <i style={{ background: item.color }} />
                {item.label}
                <strong>{item.value}</strong>
                <small>{statusTotal ? `${Math.round((item.value / statusTotal) * 100)}%` : "0%"}</small>
              </span>
            ))}
          </div>
        </section>

        <div className="admin-model-charts">
          <AdminModelLineChart
            labels={chartData.labels}
            series={[
              { label: "Pedidos", values: chartData.ordersCreated, color: "#0f9d66" },
              { label: "Pagados", values: chartData.ordersPaid, color: "#2f6bff" },
              { label: "Tickets", values: chartData.ticketsIssued, color: "#c2185b" }
            ]}
            title="Pedidos y tickets por periodo"
          />
          <AdminModelLineChart
            labels={chartData.labels}
            series={[
              { label: "Ingresos", values: chartData.income, color: "#0f9d66" },
              { label: "Tickets $", values: chartData.ticketTotals, color: "#2f6bff" },
              { label: "Pendientes", values: chartData.pendingOrders, color: "#c2185b" }
            ]}
            title="Ingresos y comprobantes"
          />
        </div>

        <section className="admin-model-footer">
          <PackageCheck size={19} />
          <span>Periodo: {periodLabel(selectedPeriod)}</span>
          <span>Mes: {salesMonth.value}</span>
          <span>Ticket promedio: {averageTicket.value}</span>
          <span>Stock activo: {getMetric(metrics, "Productos activos").value}</span>
          <span>Sin stock: {getMetric(metrics, "Productos sin stock").value}</span>
          <span>Usuarios: {getMetric(metrics, "Usuarios registrados").value}</span>
        </section>
      </section>
    </AdminShell>
  );
}
