import Link from "next/link";
import { MessageCircle, Package, Settings, UserRound } from "lucide-react";
import type { SessionProfile } from "@/lib/auth/get-user";

export function AccountShell({ profile, view = "inicio" }: { profile: SessionProfile; view?: string }) {
  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Mi cuenta</span>
            <h1>{profile.full_name || profile.email}</h1>
            <p>Gestiona datos personales, pedidos, direcciones y conversaciones con FZAC.</p>
          </div>
        </div>

        <div className="quick-grid">
          <Link className="quick-card" href="/cuenta/pedidos">
            <Package size={24} />
            <h3>Pedidos</h3>
            <p>Historial de ordenes, pagos y tickets.</p>
          </Link>
          <Link className="quick-card" href="/cuenta/direcciones">
            <UserRound size={24} />
            <h3>Direcciones</h3>
            <p>Datos de entrega y distancia a Rosario.</p>
          </Link>
          <Link className="quick-card" href="/cuenta/conversaciones">
            <MessageCircle size={24} />
            <h3>Conversaciones</h3>
            <p>Mensajes con asistente y atencion comercial.</p>
          </Link>
        </div>

        <section className="account-panel" style={{ marginTop: 18, padding: 18 }}>
          <h2>{view}</h2>
          <p style={{ color: "var(--color-muted)" }}>
            Esta vista queda conectada a Supabase por RLS. Los datos reales se muestran cuando existan registros para tu usuario.
          </p>
          <Link className="btn btn--ghost" href="/cuenta/ajustes">
            <Settings size={18} />
            Ajustes
          </Link>
        </section>
      </div>
    </main>
  );
}
