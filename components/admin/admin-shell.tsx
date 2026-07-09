import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { getAdminConsolePath } from "@/lib/utils/env";
import type { ReactNode } from "react";

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  const adminPath = getAdminConsolePath();

  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Panel admin</span>
            <h1>{title}</h1>
            <p>Operaciones protegidas. Las claves privadas no se usan en el navegador.</p>
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
