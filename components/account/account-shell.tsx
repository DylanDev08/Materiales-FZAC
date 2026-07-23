import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  UserRound
} from "lucide-react";
import { AccountAddressManager } from "@/components/account/account-address-manager";
import { AccountConsumerRequests, AccountOrders, AccountProducts, AccountSummary } from "@/components/account/account-sections";
import { AccountSettingsForm } from "@/components/account/account-settings-form";
import type { SessionProfile } from "@/lib/auth/get-user";
import { getAdminConsolePath } from "@/lib/utils/env";
import type { AccountOverview } from "@/lib/db/account";

const nav = [
  { href: "/cuenta", label: "Resumen", icon: LayoutDashboard, view: "inicio" },
  { href: "/cuenta/pedidos", label: "Compras", icon: Package, view: "pedidos" },
  { href: "/cuenta/direcciones", label: "Direcciones", icon: MapPin, view: "direcciones" },
  { href: "/cuenta/conversaciones", label: "Conversaciones", icon: MessageCircle, view: "conversaciones" },
  { href: "/cuenta/solicitudes", label: "Solicitudes", icon: RotateCcw, view: "solicitudes" },
  { href: "/cuenta/ajustes", label: "Ajustes", icon: Settings, view: "ajustes" }
] as const;

type AccountView = (typeof nav)[number]["view"];

export function AccountShell({
  profile,
  overview,
  view = "inicio"
}: {
  profile: SessionProfile;
  overview: AccountOverview;
  view?: AccountView;
}) {
  const adminPath = getAdminConsolePath();
  const active = nav.find((item) => item.view === view) ?? nav[0];

  return (
    <main className="account-page">
      <section className="account-page__header">
        <div className="container account-page__header-inner">
          <div className="account-page__identity">
            <span className="account-avatar">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={profile.full_name || profile.email} referrerPolicy="no-referrer" />
              ) : (
                <Image src="/logoFZAC.jpg" alt="FZAC" width={72} height={72} />
              )}
            </span>
            <div><span className="kicker">Mi cuenta FZAC</span><h1>{profile.full_name || "Mi cuenta"}</h1><p>{profile.email}</p></div>
          </div>
          <div className="account-page__header-actions">
            {profile.role === "ADMIN" ? <Link className="btn" href={adminPath}><LayoutDashboard size={18} /> Panel admin</Link> : null}
            <Link className="btn btn--ghost" href="/productos"><ShoppingBag size={18} /> Seguir comprando</Link>
          </div>
        </div>
      </section>

      <div className="container account-page__layout">
        <aside className="account-sidebar">
          <nav aria-label="Secciones de Mi cuenta">
            {nav.map(({ href, label, icon: Icon, view: itemView }) => (
              <Link href={href} key={href} className={view === itemView ? "is-active" : ""}><Icon size={18} /> {label}<ArrowRight size={15} /></Link>
            ))}
          </nav>
          <div className="account-sidebar__context">
            <small>Última compra</small><strong>{overview.lastOrderDate}</strong>
            <small>Productos reservados</small><strong>{overview.reservedProducts}</strong>
          </div>
        </aside>

        <div className="account-main">
          <header className="account-main__title"><div><span className="kicker">{active.label}</span><h2>{view === "inicio" ? "Tu actividad en FZAC" : active.label}</h2></div></header>

          {view === "inicio" ? (
            <>
              <AccountSummary overview={overview} />
              <div className="account-main__columns">
                <section className="account-section"><header className="account-section__head"><div><h2>Últimos pedidos</h2><p>Importes y estados más recientes.</p></div><Link href="/cuenta/pedidos">Ver todos <ArrowRight size={15} /></Link></header><AccountOrders rows={overview.orders.slice(0, 4)} /></section>
                <section className="account-section"><header className="account-section__head"><div><h2>Productos comprados</h2><p>Cantidades y stock actual.</p></div></header><AccountProducts rows={overview.products.slice(0, 4)} /></section>
              </div>
            </>
          ) : null}

          {view === "pedidos" ? <section className="account-section"><header className="account-section__head"><div><h2>Compras y pedidos</h2><p>Seguimiento de todas las compras asociadas a tu cuenta.</p></div></header><AccountOrders rows={overview.orders} /></section> : null}

          {view === "direcciones" ? (
            <>
              <section className="account-section account-personal-summary"><header className="account-section__head"><div><span className="kicker">Datos del comprador</span><h2>Información personal</h2></div></header><div><span><UserRound size={17} /> {profile.full_name || "Nombre pendiente"}</span><span>{profile.phone || "Teléfono pendiente"}</span><span>{profile.email}</span></div></section>
              <AccountAddressManager initialAddresses={overview.addresses} />
            </>
          ) : null}

          {view === "conversaciones" ? (
            <section className="account-section"><header className="account-section__head"><div><h2>Conversaciones</h2><p>Historial del asistente y consultas asociadas a tu cuenta.</p></div></header>
              <div className="account-conversation-list">{overview.conversations.length ? overview.conversations.map((conversation) => <article key={conversation.id}><MessageCircle size={19} /><div><strong>{conversation.subject}</strong><span>{conversation.lastMessageAt}</span></div><span className="status-pill">{conversation.status === "OPEN" ? "Abierta" : conversation.status === "RESOLVED" ? "Resuelta" : "En seguimiento"}</span></article>) : <p className="account-empty">Todavía no hay conversaciones guardadas.</p>}</div>
            </section>
          ) : null}

          {view === "solicitudes" ? (
            <section className="account-section">
              <header className="account-section__head">
                <div>
                  <h2>Arrepentimientos y devoluciones</h2>
                  <p>Seguimiento de solicitudes registradas con tu cuenta o email.</p>
                </div>
                <Link href="/arrepentimiento">Nueva solicitud <ArrowRight size={15} /></Link>
              </header>
              <AccountConsumerRequests rows={overview.consumerRequests} />
            </section>
          ) : null}

          {view === "ajustes" ? (
            <>
              <section className="account-section"><header className="account-section__head"><div><span className="kicker">Perfil</span><h2>Identidad y contacto</h2><p>Información usada para completar compras y mostrar tu cuenta.</p></div></header><AccountSettingsForm profile={profile} /></section>
              <AccountAddressManager initialAddresses={overview.addresses} />
              <section className="account-section account-security-note"><LockKeyhole size={22} /><div><strong>Acceso protegido por Fortaleza Construcciones</strong><p>La contraseña y Google OAuth se administran en un flujo seguro. FZAC no puede ver tu contraseña.</p></div><Link href="/login">Gestionar acceso <ArrowRight size={15} /></Link></section>
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
