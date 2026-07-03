import Link from "next/link";
import { Boxes, CreditCard, LayoutDashboard, MapPin, MessageCircle, Package, Settings, ShoppingBag, UserRound, WalletCards } from "lucide-react";
import { AccountSettingsForm } from "@/components/account/account-settings-form";
import type { SessionProfile } from "@/lib/auth/get-user";
import { getAdminConsolePath } from "@/lib/utils/env";
import type { AccountOverview } from "@/lib/db/account";

const nav = [
  { href: "/cuenta", label: "Resumen", icon: LayoutDashboard },
  { href: "/cuenta/pedidos", label: "Compras", icon: Package },
  { href: "/cuenta/direcciones", label: "Datos y direcciones", icon: MapPin },
  { href: "/cuenta/conversaciones", label: "Conversaciones", icon: MessageCircle },
  { href: "/cuenta/ajustes", label: "Ajustes", icon: Settings }
];

function initials(profile: SessionProfile) {
  const source = profile.full_name || profile.email;
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AccountShell({
  profile,
  overview,
  view = "inicio"
}: {
  profile: SessionProfile;
  overview: AccountOverview;
  view?: "inicio" | "pedidos" | "direcciones" | "conversaciones" | "ajustes";
}) {
  const adminPath = getAdminConsolePath();
  const activeHref =
    view === "pedidos"
      ? "/cuenta/pedidos"
      : view === "direcciones"
        ? "/cuenta/direcciones"
        : view === "conversaciones"
          ? "/cuenta/conversaciones"
          : view === "ajustes"
            ? "/cuenta/ajustes"
            : "/cuenta";

  return (
    <main className="page-section">
      <div className="container">
        <section className="account-hero">
          <div className="account-hero__identity">
            <span className="account-avatar">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name || profile.email} />
              ) : (
                initials(profile)
              )}
            </span>
            <div>
              <span className="kicker">Mi cuenta FZAC</span>
              <h1>{profile.full_name || profile.email}</h1>
              <p>{profile.email}</p>
            </div>
          </div>
          <div className="account-hero__actions">
            {profile.role === "ADMIN" ? (
              <Link className="btn" href={adminPath}>
                <LayoutDashboard size={18} />
                Panel admin
              </Link>
            ) : null}
            <Link className="btn btn--ghost" href="/productos">
              <ShoppingBag size={18} />
              Vista cliente
            </Link>
          </div>
        </section>

        <section className="account-summary-grid" aria-label="Resumen de cuenta">
          <article>
            <WalletCards size={20} />
            <span>Saldo disponible</span>
            <strong>{overview.balance}</strong>
          </article>
          <article>
            <CreditCard size={20} />
            <span>Total comprado</span>
            <strong>{overview.totalSpent}</strong>
          </article>
          <article>
            <Package size={20} />
            <span>Pedidos</span>
            <strong>{overview.ordersCount}</strong>
          </article>
          <article>
            <Boxes size={20} />
            <span>Productos comprados</span>
            <strong>{overview.purchasedProducts}</strong>
          </article>
        </section>

        <nav className="account-nav" aria-label="Secciones de cuenta">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href} className={activeHref === href ? "active" : ""}>
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        {view === "inicio" ? (
          <div className="account-content-grid">
            <section className="account-panel">
              <h2>Ultimas compras</h2>
              <AccountOrders rows={overview.orders.slice(0, 4)} />
            </section>
            <section className="account-panel">
              <h2>Productos comprados y stock</h2>
              <AccountProducts rows={overview.products.slice(0, 4)} />
            </section>
          </div>
        ) : null}

        {view === "pedidos" ? (
          <section className="account-panel">
            <h2>Compras y pedidos</h2>
            <AccountOrders rows={overview.orders} />
          </section>
        ) : null}

        {view === "direcciones" ? (
          <section className="account-panel">
            <h2>Datos personales y direcciones</h2>
            <div className="account-data-list">
              <span>
                <UserRound size={17} /> {profile.full_name || "Nombre pendiente"}
              </span>
              <span>{profile.phone || "Telefono pendiente"}</span>
              <span>{profile.email}</span>
            </div>
            <div className="account-address-grid">
              {overview.addresses.length ? (
                overview.addresses.map((address) => (
                  <article key={`${address.label}-${address.street}-${address.number}`}>
                    <strong>{address.label}</strong>
                    <span>
                      {address.street} {address.number}
                    </span>
                    <span>
                      {address.city}, {address.province} {address.postalCode}
                    </span>
                  </article>
                ))
              ) : (
                <p className="account-empty">Todavia no hay direcciones guardadas. Podras coordinarlas por WhatsApp al cerrar el pedido.</p>
              )}
            </div>
          </section>
        ) : null}

        {view === "conversaciones" ? (
          <section className="account-panel">
            <h2>Conversaciones</h2>
            <div className="account-list">
              {overview.conversations.length ? (
                overview.conversations.map((conversation) => (
                  <article key={conversation.id}>
                    <div>
                      <strong>{conversation.subject}</strong>
                      <span>{conversation.lastMessageAt}</span>
                    </div>
                    <span className="status-pill">{conversation.status}</span>
                  </article>
                ))
              ) : (
                <p className="account-empty">No hay conversaciones guardadas para esta cuenta.</p>
              )}
            </div>
          </section>
        ) : null}

        {view === "ajustes" ? (
          <section className="account-panel">
            <h2>Ajustes reales de usuario</h2>
            <p className="account-muted">Estos datos quedan guardados en tu perfil de Supabase y se usan para checkout y atencion comercial.</p>
            <AccountSettingsForm profile={profile} />
          </section>
        ) : null}
      </div>
    </main>
  );
}

function AccountOrders({ rows }: { rows: AccountOverview["orders"] }) {
  if (!rows.length) return <p className="account-empty">Todavia no hay pedidos para mostrar.</p>;

  return (
    <div className="account-list">
      {rows.map((order) => (
        <article key={order.id}>
          <div>
            <strong>{order.total}</strong>
            <span>
              {order.date} · {order.delivery}
            </span>
          </div>
          <span className="status-pill">{order.status}</span>
        </article>
      ))}
    </div>
  );
}

function AccountProducts({ rows }: { rows: AccountOverview["products"] }) {
  if (!rows.length) return <p className="account-empty">Los productos comprados apareceran cuando exista una compra aprobada.</p>;

  return (
    <div className="account-product-list">
      {rows.map((product) => (
        <article key={`${product.sku}-${product.name}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={product.imageUrl} alt={product.name} />
          <div>
            <strong>{product.name}</strong>
            <span>
              {product.quantity} unidades · {product.total}
            </span>
            <small>Stock actual: {product.stock}</small>
          </div>
        </article>
      ))}
    </div>
  );
}
