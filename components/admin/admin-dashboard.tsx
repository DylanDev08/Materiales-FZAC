import { AlertTriangle, CreditCard, FileText, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";

export async function AdminDashboard() {
  const data = await getAdminDashboardData();
  const icons = [CreditCard, TrendingUp, ShoppingBag, CreditCard, AlertTriangle, FileText, Users, Package, ShoppingBag];
  const statusTotal = data.statusCounts.reduce((sum, item) => sum + item.count, 0) || 1;

  return (
    <AdminShell title="Dashboard">
      <section className="metrics-grid">
        {data.metrics.map((metric, index) => {
          const Icon = icons[index] ?? FileText;
          return (
            <article className="metric-card" key={metric.label}>
              <Icon size={22} />
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
              <small>{metric.helper}</small>
            </article>
          );
        })}
      </section>

      <section className="admin-panel">
        <h2>Estados de pedidos recientes</h2>
        <div className="admin-status-bar">
          {data.statusCounts.length ? (
            data.statusCounts.map((item) => (
              <span key={item.status} style={{ width: `${Math.max(4, (item.count / statusTotal) * 100)}%` }}>
                {item.status} · {item.count}
              </span>
            ))
          ) : (
            <span style={{ width: "100%" }}>Sin pedidos recientes</span>
          )}
        </div>
      </section>

      <section className="admin-panel">
        <h2>Ultimos pedidos</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {["Cliente", "Email", "Estado", "Total", "Fecha"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentOrders.map((row, index) => (
                <tr key={index}>
                  <td>{row.Cliente}</td>
                  <td>{row.Email}</td>
                  <td>{row.Estado}</td>
                  <td>{row.Total}</td>
                  <td>{row.Fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-panel">
        <h2>Ultimos tickets</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {["Numero", "Cliente", "Total", "Estado", "Fecha"].map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.recentTickets.map((row, index) => (
                <tr key={index}>
                  <td>{row.Numero}</td>
                  <td>{row.Cliente}</td>
                  <td>{row.Total}</td>
                  <td>{row.Estado}</td>
                  <td>{row.Fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
