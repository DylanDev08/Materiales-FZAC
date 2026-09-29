import Link from "next/link";
import { BarChart3, CreditCard, ExternalLink, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";
import { getVercelAnalyticsStatus } from "@/lib/observability/vercel";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

type Metric = { label: string; value: string; helper: string };

function metric(metrics: Metric[], label: string) {
  return metrics.find((item) => item.label === label) ?? { label, value: "0", helper: "Sin movimientos" };
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  await requireAdmin();
  const [data, traffic] = await Promise.all([
    getAdminDashboardData("month"),
    Promise.resolve(getVercelAnalyticsStatus())
  ]);
  const metrics = data.metrics as Metric[];
  const adminPath = getAdminConsolePath();

  const cards = [
    { label: "Ventas del mes", value: metric(metrics, "Ventas del mes").value, helper: "Facturación confirmada", icon: TrendingUp },
    { label: "Pagos aprobados", value: metric(metrics, "Pagos aprobados").value, helper: "Cobros confirmados", icon: CreditCard },
    { label: "Pedidos vendidos", value: metric(metrics, "Pedidos pagados").value, helper: "Pedidos con pago confirmado", icon: ShoppingBag },
    { label: "Ticket promedio", value: metric(metrics, "Ticket promedio").value, helper: "Promedio por venta", icon: BarChart3 },
    { label: "Clientes nuevos", value: metric(metrics, "Clientes nuevos").value, helper: "Altas del mes", icon: Users }
  ];

  return (
    <AdminShell
      title="Analíticas"
      description="Ventas, cobros y comportamiento de la tienda en un solo lugar."
    >
      <div className="admin-vercel-analytics">
        <section className="admin-vercel-analytics__hero">
          <div>
            <span className="kicker">Rendimiento comercial</span>
            <h2>Cómo está funcionando la tienda</h2>
            <p>
              Acá se combinan los resultados reales del e-commerce con el tráfico de la web para entender cuánto se vende,
              cuántos pedidos se convierten y qué necesita atención.
            </p>
          </div>
          <Link className="btn btn--primary" href={`${adminPath}/pedidos`}>Ver ventas</Link>
        </section>

        <section className="admin-vercel-analytics__metrics" aria-label="Indicadores comerciales">
          {cards.map(({ label, value, helper, icon: Icon }) => (
            <article key={label}>
              <Icon size={22} />
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{helper}</small>
            </article>
          ))}
        </section>

        <section className="admin-vercel-analytics__actions">
          <div>
            <h3>Tráfico de la tienda</h3>
            <p>
              Consultá visitantes, páginas más vistas, dispositivos y origen de las visitas para entender qué atrae clientes.
            </p>
          </div>
          <a className="btn btn--primary" href={traffic.analyticsUrl} rel="noreferrer" target="_blank">
            Ver tráfico y visitas <ExternalLink size={17} />
          </a>
          <Link className="btn btn--ghost" href={`${adminPath}/reportes`}>Abrir reportes</Link>
        </section>

        <p className="admin-vercel-analytics__note">
          Las visitas se registran respetando las preferencias de privacidad del cliente. Las ventas, pagos, tickets y movimientos
          financieros provienen directamente del e-commerce.
        </p>
      </div>
    </AdminShell>
  );
}
