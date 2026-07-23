import { CheckCircle2, CircleAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSystemStatus, type SystemStatusItem } from "@/lib/system/status";

function StatusIcon({ tone }: { tone: SystemStatusItem["tone"] }) {
  if (tone === "success") return <CheckCircle2 size={18} />;
  if (tone === "danger") return <CircleAlert size={18} />;
  return <TriangleAlert size={18} />;
}

export default async function Page() {
  await requireAdmin();
  const status = await getSystemStatus();

  return (
    <AdminShell title="Estado del sistema" description="Control de producción para pagos, emails, Supabase y seguridad.">
      <section className="admin-system-page">
        <article className={`admin-system-hero ${status.readyForProduction ? "is-ready" : "is-pending"}`}>
          <div>
            <span className="kicker">Producción controlada</span>
            <h2>{status.readyForProduction ? "FZAC está listo para operar" : "Hay puntos pendientes antes de producción real"}</h2>
            <p>
              Esta vista no muestra claves ni tokens. Solo confirma si las piezas críticas están configuradas para vender,
              cobrar, notificar y operar sin exponer datos sensibles.
            </p>
          </div>
          <div className="admin-system-hero__badge">
            <ShieldCheck size={22} />
            <strong>{status.pending.length}</strong>
            <span>pendientes</span>
          </div>
        </article>

        <section className="admin-system-grid" aria-label="Estado de integraciones">
          {status.items.map((item) => (
            <article className={`admin-system-card admin-system-card--${item.tone}`} key={item.label}>
              <header>
                <StatusIcon tone={item.tone} />
                <span>{item.value}</span>
              </header>
              <h3>{item.label}</h3>
              <p>{item.detail}</p>
            </article>
          ))}
        </section>

        <section className="admin-docs-note">
          <strong>Checklist antes de producción</strong>
          <p>
            Rotar claves compartidas, verificar dominio Resend, pasar Mercado Pago a producción, confirmar webhook real,
            auditar RLS en Supabase y ejecutar una compra real de bajo monto con reembolso completo.
          </p>
        </section>
      </section>
    </AdminShell>
  );
}
