"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  AreaChart,
  ChevronDown,
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  Grid3X3,
  Home,
  Landmark,
  Menu,
  MessageCircle,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  ReceiptText,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  BadgeDollarSign,
  TrendingUp,
  Users,
  X
} from "lucide-react";

const primaryLinks = [
  { path: "", label: "Inicio", icon: Home },
  { path: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { path: "/productos", label: "Productos", icon: Package },
  { path: "/inventario", label: "Stock", icon: Package },
  { path: "/clientes", label: "Clientes", icon: Users },
  { path: "/proveedores", label: "Proveedores", icon: Building2 },
  { path: "/chats", label: "Mensajes", icon: MessageCircle }
];

const additionalLinks = [
  { path: "/categorias", label: "Categorías", icon: Grid3X3 },
  { path: "/arrepentimientos", label: "Cambios y devoluciones", icon: RotateCcw },
  { path: "/compras", label: "Compras a proveedores", icon: ShoppingBasket },
  { path: "/cuentas-proveedores", label: "Cuentas por pagar", icon: ReceiptText },
  { path: "/auditoria-precios", label: "Control de precios", icon: ShieldCheck },
  { path: "/precios-mercado", label: "Precios de mercado", icon: TrendingUp },
  { path: "/pagos", label: "Cobros y transferencias", icon: CreditCard },
  { path: "/tickets", label: "Tickets", icon: FileText },
  { path: "/reportes", label: "Reportes PDF", icon: FileText },
  { path: "/finanzas", label: "Caja interna", icon: Landmark },
  { path: "/rentabilidad", label: "Rentabilidad", icon: BadgeDollarSign },
  { path: "/analiticas", label: "Analíticas", icon: AreaChart },
  { path: "/operaciones", label: "Estado de servicios", icon: Activity },
  { path: "/sistema", label: "Configuración", icon: ShieldCheck }
];

const allLinks = [...primaryLinks, ...additionalLinks];

function normalizePath(value: string) {
  return value.replace(/\/+$/, "") || "/";
}

export function AdminSidebar({ adminPath }: { adminPath: string }) {
  const pathname = normalizePath(usePathname());
  const normalizedAdminPath = normalizePath(adminPath);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showMore, setShowMore] = useState(() => additionalLinks.some(({ path }) => pathname === `${normalizedAdminPath}${path}` || pathname.startsWith(`${normalizedAdminPath}${path}/`)));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCollapsed(window.localStorage.getItem("fzac-admin-sidebar-collapsed") === "true");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  function hrefFor(path: string) {
    if (path.startsWith("public:")) return path.replace("public:", "");
    return path.startsWith("?") ? `${normalizedAdminPath}${path}` : `${normalizedAdminPath}${path}`;
  }

  function isActive(path: string) {
    if (path.startsWith("public:")) return false;
    if (path.startsWith("?")) return false;
    const href = normalizePath(`${normalizedAdminPath}${path}`);
    if (!path) return pathname === normalizedAdminPath;

    const matchingHrefs = allLinks
      .map((link) => link.path)
      .filter((candidate) => candidate && !candidate.startsWith("?") && !candidate.startsWith("public:"))
      .map((candidate) => normalizePath(`${normalizedAdminPath}${candidate}`))
      .filter((candidateHref) => pathname === candidateHref || pathname.startsWith(`${candidateHref}/`))
      .sort((left, right) => right.length - left.length);

    return href === matchingHrefs[0];
  }

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("fzac-admin-sidebar-collapsed", String(next));
      return next;
    });
  }

  return (
    <>
      <button
        className="admin-mobile-menu-button"
        type="button"
        aria-controls="admin-primary-navigation"
        aria-expanded={mobileOpen}
        aria-label={mobileOpen ? "Cerrar navegación administrativa" : "Abrir navegación administrativa"}
        onClick={() => setMobileOpen((current) => !current)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        <span>Secciones</span>
      </button>
      {mobileOpen ? (
        <button
          className="admin-sidebar-backdrop"
          type="button"
          aria-label="Cerrar navegación administrativa"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}
      <aside
        className={`admin-sidebar ${mobileOpen ? "is-open" : ""} ${collapsed ? "is-collapsed" : ""}`}
        id="admin-primary-navigation"
      >
        <Link className="admin-sidebar__brand" href={normalizedAdminPath} onClick={() => setMobileOpen(false)}>
          <span>
            <Image src="/logoFZAC.jpg" alt="FZAC" width={58} height={58} unoptimized />
          </span>
          <div className="admin-sidebar__brand-copy">
            <strong>FZAC Materiales</strong>
            <small>Panel comercial</small>
          </div>
        </Link>
        <nav aria-label="Secciones de administracion">
          <div className="admin-sidebar__group">
            <p>Gestión diaria</p>
            {primaryLinks.map(({ path, label, icon: Icon }) => (
              <Link
                className={isActive(path) ? "active" : undefined}
                key={path || "dashboard"}
                href={hrefFor(path)}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </div>
          <div className="admin-sidebar__group">
            <button
              className="admin-sidebar__more-toggle"
              type="button"
              aria-expanded={showMore}
              aria-controls="admin-additional-navigation"
              title={collapsed ? "Más herramientas" : undefined}
              onClick={() => setShowMore((current) => !current)}
            >
              <Grid3X3 size={18} />
              <span>Más herramientas</span>
              <ChevronDown size={16} className={showMore ? "is-open" : undefined} />
            </button>
            {showMore ? (
              <div id="admin-additional-navigation">
                {additionalLinks.map(({ path, label, icon: Icon }) => (
                  <Link
                    className={isActive(path) ? "active" : undefined}
                    key={path}
                    href={hrefFor(path)}
                    onClick={() => setMobileOpen(false)}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                  </Link>
                ))}
              </div>
            ) : null}
            <Link href="/productos" onClick={() => setMobileOpen(false)}>
              <Home size={18} />
              <span>Ver tienda</span>
            </Link>
          </div>
        </nav>
        <button
          className="admin-sidebar__collapse"
          type="button"
          aria-label={collapsed ? "Expandir menu administrativo" : "Contraer menu administrativo"}
          aria-pressed={collapsed}
          onClick={toggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span>{collapsed ? "Expandir menu" : "Contraer menu"}</span>
        </button>
      </aside>
    </>
  );
}
