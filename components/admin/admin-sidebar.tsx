"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BrainCircuit,
  BookOpen,
  CreditCard,
  FileText,
  Grid3X3,
  Home,
  Landmark,
  ListChecks,
  Menu,
  MessageCircle,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Palette,
  RotateCcw,
  ReceiptText,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingBasket,
  TrendingUp,
  Users,
  X
} from "lucide-react";

const linkGroups = [
  {
    title: "Resumen",
    links: [
      { path: "", label: "Dashboard", icon: BarChart3 },
      { path: "?tab=notifications", label: "Notificaciones", icon: Bell },
      { path: "/logs", label: "Actividad", icon: Activity }
    ]
  },
  {
    title: "Ventas y clientes",
    links: [
      { path: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { path: "/pagos", label: "Pagos", icon: CreditCard },
      { path: "/tickets", label: "Tickets", icon: FileText },
      { path: "/clientes", label: "Clientes", icon: Users },
      { path: "/arrepentimientos", label: "Devoluciones", icon: RotateCcw },
      { path: "/finanzas", label: "Ingresos y egresos", icon: Landmark }
    ]
  },
  {
    title: "Stock y compras",
    links: [
      { path: "/inventario", label: "Inventario", icon: Package },
      { path: "/compras", label: "Compras y proveedores", icon: ShoppingBasket },
      { path: "/cuentas-proveedores", label: "Cuentas por pagar", icon: ReceiptText },
      { path: "/productos", label: "Productos", icon: Package },
      { path: "/categorias", label: "Categorias", icon: Grid3X3 },
      { path: "/precios-mercado", label: "Precios de mercado", icon: TrendingUp }
    ]
  },
  {
    title: "Atencion asistida",
    links: [
      { path: "/chats", label: "Chats", icon: MessageCircle },
      { path: "/conocimiento", label: "Conocimiento IA", icon: BrainCircuit },
      { path: "/calidad-ia", label: "Calidad IA", icon: ListChecks }
    ]
  },
  {
    title: "Configuracion",
    links: [
      { path: "/documentacion", label: "Guia del panel", icon: BookOpen },
      { path: "/pagos/eventos", label: "Comprobantes de pago", icon: Activity },
      { path: "/sistema", label: "Estado del sistema", icon: ShieldCheck },
      { path: "/apariencia", label: "Apariencia", icon: Palette },
      { path: "/ajustes", label: "Ajustes", icon: Settings },
      { path: "public:/productos", label: "Vista cliente", icon: Home }
    ]
  }
];

function normalizePath(value: string) {
  return value.replace(/\/+$/, "") || "/";
}

export function AdminSidebar({ adminPath }: { adminPath: string }) {
  const pathname = normalizePath(usePathname());
  const normalizedAdminPath = normalizePath(adminPath);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
    return pathname === href || pathname.startsWith(`${href}/`);
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
          {linkGroups.map((group) => (
            <div className="admin-sidebar__group" key={group.title}>
              <p>{group.title}</p>
              {group.links.map(({ path, label, icon: Icon }) => (
                <Link
                  className={isActive(path) ? "active" : undefined}
                  key={`${group.title}-${path || "dashboard"}`}
                  href={hrefFor(path)}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? label : undefined}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          ))}
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
