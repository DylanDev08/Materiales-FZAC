import Link from "next/link";
import { ArrowRight, Building2, MessageCircle, Package, ShoppingBag, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminDashboardData } from "@/lib/db/admin";
import { getAdminConsolePath } from "@/lib/utils/env";

type Metric = { label: string; value: string; helper: string };

function metric(metrics: Metric[], label: string) {
  return metrics.find((item) => item.label === label)?.value ?? "—";
}

const shortcuts = [
  { path: "/pedidos", title: "Revisar pedidos", description: "Consultar pedidos y coordinar por WhatsApp", icon: ShoppingBag },
  { path: "/productos", title: "Administrar productos", description: "Precios, fotos y publicaciones", icon: Package },
  { path: "/inventario", title: "Controlar stock", description: "Disponibilidad y reposición", icon: Package },
  { path: "/clientes", title: "Ver clientes", description: "Consultas y datos de contacto", icon: Users },
  { path: "/proveedores", title: "Ver proveedores", description: "Catálogo y abastecimiento", icon: Building2 },
  { path: "/chats", title: "Responder mensajes", description: "Conversaciones que necesitan atención", icon: MessageCircle }
];

export async function AdminDashboard({ period: _period }: { period?: string }) {
  // Las estadísticas del inicio usan el mismo servicio que el resto del admin,
  // pero no muestran métricas de pasarelas, gráficos ni finanzas internas.
  const data = await getAdminDashboardData("month");
  const adminPath = getAdminConsolePath();
  const metrics = data.metrics as Metric[];
  const recentOrders = data.recentOrders as Array<Record<string, unknown>>;

  return (
    <AdminShell title="Inicio" description="Gestioná productos, pedidos y consultas de la tienda desde un solo lugar.">
      <section className="admin-quick-overview" aria-label="Resumen de la tienda">
        <header>
          <div>
            <span className="kicker">Materiales FZAC</span>
            <h2>Resumen de la tienda</h2>
          </div>
          <small>Los pagos se coordinan por transferencia y WhatsApp.</small>
        </header>
        <div>
          {[
            { label: "Pedidos a revisar", value: metric(metrics, "Aprobacion admin"), href: "/pedidos", helper: "Requieren aprobación" },
            { label: "Productos activos", value: metric(metrics, "Productos activos"), href: "/productos", helper: "Publicados en la tienda" },
            { label: "Bajo stock", value: metric(metrics, "Productos bajo stock"), href: "/inventario", helper: "Revisar disponibilidad" },
            { label: "Mensajes pendientes", value: metric(metrics, "Chats pendientes"), href: "/chats", helper: "Consultas para responder" }
          ].map((item) => (
            <Link className="admin-quick-overview__item is-yellow" key={item.label} href={adminPath + item.href}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small>{item.helper}</small>
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-task-center" aria-label="Accesos rápidos">
        <header>
          <div>
            <span className="kicker">Acciones diarias</span>
            <h2>¿Qué necesitás hacer?</h2>
          </div>
        </header>
        <div className="admin-task-center__grid">
          {shortcuts.map(({ path, title, description, icon: Icon }) => (
            <Link className="admin-task-card" href={adminPath + path} key={path}>
              <span><Icon size={19} /></span>
              <div>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>

      <section className="admin-recent-control admin-simple-recent" aria-label="Pedidos recientes">
        <header>
          <div>
            <span className="kicker">Seguimiento</span>
            <h2>Últimos pedidos</h2>
          </div>
          <Link href={adminPath + "/pedidos"}>Ver todos los pedidos</Link>
        </header>
        <div className="admin-recent-control__grid">
          <article>
            <div className="admin-recent-control__list">
              {recentOrders.length ? recentOrders.slice(0, 5).map((order, index) => (
                <div key={index}>
                  <span>{String(order.Cliente ?? "Cliente")}</span>
                  <strong>{String(order.Total ?? "—")}</strong>
                  <small>{String(order.Estado ?? "Pendiente")} · {String(order.Fecha ?? "")}</small>
                </div>
              )) : <p>Todavía no hay pedidos recientes.</p>}
            </div>
          </article>
        </div>
      </section>
    </AdminShell>
  );
}
