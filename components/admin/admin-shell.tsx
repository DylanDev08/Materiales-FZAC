import { AdminSidebar } from "@/components/admin/admin-sidebar";
import type { ReactNode } from "react";

export function AdminShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="page-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">Panel admin</span>
            <h1>{title}</h1>
            <p>Operaciones protegidas por backend. No se usa service role en cliente.</p>
          </div>
        </div>

        <div className="admin-layout">
          <AdminSidebar />
          <div>{children}</div>
        </div>
      </div>
    </main>
  );
}
