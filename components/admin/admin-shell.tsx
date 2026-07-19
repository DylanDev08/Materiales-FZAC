import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { AdminNotificationBell } from "@/components/admin/admin-notification-bell";
import { getAdminConsolePath } from "@/lib/utils/env";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function AdminShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const adminPath = getAdminConsolePath();

  return (
    <main className="admin-page">
      <div className="admin-app-shell">
        <AdminSidebar adminPath={adminPath} />
        <section className="admin-workspace">
          <header className="admin-topbar">
            <div className="admin-topbar__title">
              <h1>{title}</h1>
              <p>{description ?? "Resumen comercial de pedidos, pagos, clientes y stock."}</p>
            </div>
            <div className="admin-topbar__actions">
              <AdminNotificationBell adminPath={adminPath} />
              <span className="admin-protected-badge">
                <ShieldCheck size={16} />
                Protegido
              </span>
              <div className="admin-topbar__user" aria-label="Cuenta administradora">
                <span className="admin-topbar__avatar">FZ</span>
                <div>
                  <strong>Admin</strong>
                  <small>Administrador</small>
                </div>
              </div>
              <Link className="admin-topbar__logout" href="/" aria-label="Salir a la tienda">
                <LogOut size={17} />
                <span>Salir</span>
              </Link>
            </div>
          </header>
          <div className="admin-content">{children}</div>
        </section>
      </div>
    </main>
  );
}
