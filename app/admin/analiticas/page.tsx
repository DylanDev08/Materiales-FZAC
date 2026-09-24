import Link from "next/link";
import { Activity, BarChart3, ExternalLink, GitCommitHorizontal, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getVercelAnalyticsStatus } from "@/lib/observability/vercel";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

function shortSha(value: string | null) {
  return value ? value.slice(0, 12) : "Disponible después del deploy";
}

export default async function Page() {
  await requireAdmin();
  const status = getVercelAnalyticsStatus();
  const adminPath = getAdminConsolePath();

  return (
    <AdminShell
      title="Analíticas y rendimiento"
      description="Estado de la medición del e-commerce y acceso seguro a Vercel Web Analytics."
    >
      <div className="admin-vercel-analytics">
        <section className="admin-vercel-analytics__hero">
          <div>
            <span className="kicker">Vercel Web Analytics</span>
            <h2>Medición instalada en toda la tienda</h2>
            <p>
              La instrumentación está instalada en el layout principal. La recepción efectiva de eventos se confirma en
              el workspace privado de Vercel: el panel no replica tokens ni credenciales.
            </p>
          </div>
          <span className="status-pill status-pill--success"><ShieldCheck size={16} />Instrumentación instalada</span>
        </section>

        <section className="admin-vercel-analytics__metrics" aria-label="Estado de Vercel Analytics">
          <article>
            <BarChart3 size={22} />
            <span>Instrumentación</span>
            <strong>{status.instrumented ? "Instalada" : "No instalada"}</strong>
            <small>La recepción de eventos se verifica en Vercel</small>
          </article>
          <article>
            <Activity size={22} />
            <span>Entorno actual</span>
            <strong>{status.environment}</strong>
            <small>{status.deploymentUrl ?? "Ejecución local"}</small>
          </article>
          <article>
            <GitCommitHorizontal size={22} />
            <span>Versión desplegada</span>
            <strong>{shortSha(status.gitCommitSha)}</strong>
            <small>SHA informado por la plataforma</small>
          </article>
        </section>

        <section className="admin-vercel-analytics__actions">
          <div>
            <h3>Tráfico real de la tienda</h3>
            <p>Revisá visitantes, páginas más vistas, fuentes de tráfico y dispositivos en el panel oficial.</p>
          </div>
          <a className="btn btn--primary" href={status.analyticsUrl} rel="noreferrer" target="_blank">
            Abrir Analytics <ExternalLink size={17} />
          </a>
          <a className="btn btn--ghost" href={status.deploymentsUrl} rel="noreferrer" target="_blank">
            Ver despliegues <ExternalLink size={17} />
          </a>
        </section>

        <p className="admin-vercel-analytics__note">
          La presencia del componente no prueba por sí sola que Vercel ya recibió eventos. Confirmá las primeras visitas en el panel oficial. Las métricas comerciales de ventas,
          costos y margen siguen separadas en <Link href={`${adminPath}/rentabilidad`}>Rentabilidad</Link> para no mezclar
          tráfico con datos contables.
        </p>
      </div>
    </AdminShell>
  );
}
