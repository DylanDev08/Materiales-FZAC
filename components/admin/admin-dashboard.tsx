import Link from "next/link";
import { AlertTriangle, CreditCard, FileText, Home, Package, ShoppingBag, TrendingUp, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";
import { isMercadoPagoConfigured } from "@/lib/payments/config";
import { getAdminConsolePath } from "@/lib/utils/env";

export async function AdminDashboard() {
  const data = await getAdminDashboardData();
  const adminPath = getAdminConsolePath();
  const paymentsReady = isMercadoPagoConfigured();
  const icons = [CreditCard, TrendingUp, ShoppingBag, CreditCard, CreditCard, AlertTriangle, FileText, Users, Package, ShoppingBag];
  const statusTotal = data.statusCounts.reduce((sum, item) => sum + item.count, 0) || 1;

  return (
    <AdminShell title="Dashboard">
      {!paymentsReady ? (
        <section className="admin-payment-status">
          El flujo comercial ya esta preparado. Solo falta configurar pagos para operar en produccion.
        </section>
      ) : null}

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

      <section className="admin-quick-actions" aria-label="Acciones rapidas de administracion">
        <Link href={`${adminPath}/pedidos`}>
          <ShoppingBag size={20} />
          <span>Revisar pedidos</span>
        </Link>
        <Link href={`${adminPath}/productos`}>
          <Package size={20} />
          <span>Gestionar stock</span>
        </Link>
        <Link href={`${adminPath}/clientes`}>
          <Users size={20} />
          <span>Ver clientes</span>
        </Link>
        <Link href="/productos">
          <Home size={20} />
          <span>Vista cliente</span>
        </Link>
      </section>

      <section className="admin-panel">
        <h2>Estado general de pedidos</h2>
        <p className="admin-help">Si hay muchos pendientes, entra a Pedidos para llamar o escribir al cliente.</p>
        <div className="admin-status-bar">
          {data.statusCounts.length ? (
            data.statusCounts.map((item) => (
              <span key={item.status} style={{ width: `${Math.max(4, (item.count / statusTotal) * 100)}%` }}>
                {`${item.status} - ${item.count}`}
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
                  <td data-label="Cliente">{row.Cliente}</td>
                  <td data-label="Email">{row.Email}</td>
                  <td data-label="Estado">{row.Estado}</td>
                  <td data-label="Total">{row.Total}</td>
                  <td data-label="Fecha">{row.Fecha}</td>
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
                  <td data-label="Numero">{row.Numero}</td>
                  <td data-label="Cliente">{row.Cliente}</td>
                  <td data-label="Total">{row.Total}</td>
                  <td data-label="Estado">{row.Estado}</td>
                  <td data-label="Fecha">{row.Fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
