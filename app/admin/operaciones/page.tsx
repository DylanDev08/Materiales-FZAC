import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, CreditCard, HardHat, PackageSearch, RefreshCcw, ServerCog, ShieldCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminOperationsOverview } from "@/lib/db/admin";
import { getSystemStatus } from "@/lib/system/status";
import { getAdminConsolePath } from "@/lib/utils/env";
import { getPaymentProductionReadiness, isMercadoPagoConfigured } from "@/lib/payments/config";

export default async function Page() {
  await requireAdmin();
  const [operations, system] = await Promise.all([getAdminOperationsOverview(), getSystemStatus()]);
  const payments = getPaymentProductionReadiness();
  const adminPath = getAdminConsolePath();
  const maintenance = process.env.MAINTENANCE_MODE?.trim().toLowerCase() === "true";

  return (
    <AdminShell title="Centro de Operaciones" description="Salud de tienda, incidencias, pagos, stock y conciliación en una sola vista.">
      <section className="admin-ops">
        <div className="admin-ops__hero">
          <div>
            <span className="kicker">Control operativo</span>
            <h2>{operations.counts.incidents ? "Hay puntos para revisar" : "Operación sin incidencias detectadas"}</h2>
            <p>Esta pantalla prioriza problemas accionables. No muestra tokens, claves ni información sensible.</p>
          </div>
          <div className={operations.counts.incidents ? "admin-ops__score is-warning" : "admin-ops__score is-ok"}>
            {operations.counts.incidents ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
            <strong>{operations.counts.incidents}</strong>
            <span>incidencias</span>
          </div>
        </div>

        <div className="admin-ops__cards">
          <article>
            <ServerCog size={20} />
            <span>Tienda</span>
            <strong>{maintenance ? "MANTENIMIENTO" : "ONLINE"}</strong>
            <small>{maintenance ? "La tienda pública está pausada." : "Storefront habilitado."}</small>
          </article>
          <article>
            <CreditCard size={20} />
            <span>Mercado Pago</span>
            <strong>{isMercadoPagoConfigured() ? "OPERATIVO" : "REVISAR"}</strong>
            <small>{payments.blockers.length ? payments.blockers.join(", ") : "Sin bloqueos de configuración."}</small>
          </article>
          <article>
            <Activity size={20} />
            <span>Webhooks</span>
            <strong>{operations.counts.failedEvents ? \`\${operations.counts.failedEvents} ERROR\` : "SIN ERRORES"}</strong>
            <small>Eventos recientes con error o procesamiento pendiente.</small>
          </article>
          <article>
            <PackageSearch size={20} />
            <span>Catálogo</span>
            <strong>{operations.counts.catalogIssues ? \`\${operations.counts.catalogIssues} REVISAR\` : "COMPLETO"}</strong>
            <small>Productos activos con datos comerciales incompletos.</small>
          </article>
        </div>

        <section className="admin-ops__maintenance">
          <div>
            <HardHat size={20} />
            <div>
              <strong>Modo mantenimiento</strong>
              <p>Estado actual: <b>{maintenance ? "ACTIVO" : "INACTIVO"}</b>. Se controla con <code>MAINTENANCE_MODE</code> en Render. El admin, APIs y webhooks quedan disponibles.</p>
            </div>
          </div>
          <Link className="btn btn--ghost" href="/mantenimiento">Vista mantenimiento</Link>
        </section>

        <section className="admin-ops__section">
          <header>
            <div><span className="kicker">Prioridad</span><h2>Incidencias detectadas</h2></div>
            <strong>{operations.incidents.length}</strong>
          </header>
          {operations.incidents.length ? (
            <div className="admin-ops__incidents">
              {operations.incidents.map((incident, index) => (
                <Link
                  href={incident.href ? \`\${adminPath}\${incident.href}\` : \`\${adminPath}/sistema\`}
                  key={\`\${incident.title}-\${index}\`}
                  className={\`admin-ops__incident admin-ops__incident--\${incident.severity}\`}
                >
                  <span><AlertTriangle size={17} /></span>
                  <div><small>{incident.area}</small><strong>{incident.title}</strong><p>{incident.detail}</p></div>
                </Link>
              ))}
            </div>
          ) : <p className="admin-ops__empty"><CheckCircle2 size={18} /> No detectamos inconsistencias operativas en los controles actuales.</p>}
        </section>

        <section className="admin-ops__section">
          <header>
            <div><span className="kicker">Mercado Pago + órdenes</span><h2>Conciliación reciente</h2></div>
            <Link href={\`\${adminPath}/pagos\`}>Abrir pagos</Link>
          </header>
          <AdminDataTable
            title="Conciliación de pedidos"
            columns={["Pedido", "Cliente", "Orden", "Pago", "Monto", "Monto pago", "Coincide", "Webhook", "Ticket", "Conciliacion"]}
            rows={operations.reconciliation}
          />
        </section>

        <section className="admin-ops__section">
          <header><div><span className="kicker">Configuración</span><h2>Estado técnico</h2></div><ShieldCheck size={22} /></header>
          <div className="admin-ops__system">
            {system.pending.length ? system.pending.slice(0, 8).map((item) => (
              <article key={item.label}><strong>{item.label}</strong><span>{item.value}</span><p>{item.detail}</p></article>
            )) : <article className="is-ok"><strong>Sin pendientes críticos</strong><span>OK</span><p>Los controles registrados por el sistema no tienen bloqueos.</p></article>}
          </div>
        </section>

        <nav className="admin-ops__tools" aria-label="Herramientas técnicas">
          <Link href={\`\${adminPath}/logs\`}><Activity size={17} /> Actividad técnica</Link>
          <Link href={\`\${adminPath}/pagos/eventos\`}><RefreshCcw size={17} /> Eventos de pago</Link>
          <Link href={\`\${adminPath}/sistema\`}><ShieldCheck size={17} /> Diagnóstico detallado</Link>
        </nav>
      </section>
    </AdminShell>
  );
}
