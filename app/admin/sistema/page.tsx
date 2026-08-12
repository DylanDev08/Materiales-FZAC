import Link from "next/link";
import { CheckCircle2, CircleAlert, ExternalLink, ShieldCheck, TriangleAlert } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getSystemStatus, type SystemStatusArea, type SystemStatusItem } from "@/lib/system/status";
import { getAdminConsolePath } from "@/lib/utils/env";

const AREAS: Array<{ name: SystemStatusArea; description: string }> = [
  { name: "Comercio", description: "Catálogo, stock, pedidos y comprobantes necesarios para vender." },
  { name: "Pagos", description: "Ambiente, proveedor, webhook e integraciones de cobro." },
  { name: "Infraestructura", description: "Servicios externos, dominio, correo e indexación." },
  { name: "Seguridad", description: "Autorización, transacciones, idempotencia y cumplimiento." }
];

function StatusIcon({ tone }: { tone: SystemStatusItem["tone"] }) {
  if (tone === "success") return <CheckCircle2 size={18} />;
  if (tone === "danger") return <CircleAlert size={18} />;
  return <TriangleAlert size={18} />;
}

export default async function Page() {
  await requireAdmin();
  const status = await getSystemStatus();
  const adminPath = getAdminConsolePath();

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

        {status.pending.length ? (
          <section className="admin-system-priority" aria-labelledby="system-priority-title">
            <div>
              <span className="kicker">Atención prioritaria</span>
              <h2 id="system-priority-title">Qué resolver antes de cobrar en producción</h2>
            </div>
            <ol>
              {status.pending.slice(0, 5).map((item) => (
                <li key={item.label}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        <div className="admin-system-sections">
          {AREAS.map((area) => {
            const items = status.items.filter((item) => item.area === area.name);
            const pending = items.filter((item) => item.tone !== "success").length;
            return (
              <section className="admin-system-section" key={area.name}>
                <header className="admin-system-section__head">
                  <div>
                    <h2>{area.name}</h2>
                    <p>{area.description}</p>
                  </div>
                  <span>{pending ? `${pending} pendientes` : "Sin pendientes"}</span>
                </header>
                <div className="admin-system-list">
                  {items.map((item) => (
                    <article className={`admin-system-row admin-system-row--${item.tone}`} key={item.label}>
                      <StatusIcon tone={item.tone} />
                      <div>
                        <h3>{item.label}</h3>
                        <p>{item.detail}</p>
                      </div>
                      <span>{item.value}</span>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        <section className="admin-system-actions" aria-label="Acciones operativas">
          <Link className="btn" href={`${adminPath}/productos`}>
            Revisar productos <ExternalLink size={16} />
          </Link>
          <Link className="btn btn--ghost" href={`${adminPath}/categorias`}>
            Ordenar categorías
          </Link>
          <Link className="btn btn--ghost" href={`${adminPath}/documentacion`}>
            Abrir guía del panel
          </Link>
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
