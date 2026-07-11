import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getAdminConsolePath } from "@/lib/utils/env";
import type { ReactNode } from "react";

export function AdminShell({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const adminPath = getAdminConsolePath();

  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Panel admin</span>
            <h1>{title}</h1>
            <p>{description ?? "Gestion comercial de pedidos, clientes, pagos, catalogo y actividad FZAC."}</p>
          </div>
        </div>

        <div className="admin-layout">
          <AdminSidebar adminPath={adminPath} />
          <div className="admin-content">{children}</div>
        </div>
      </div>
    </main>
  );
}
