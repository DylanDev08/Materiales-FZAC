"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CreditCard,
  FileText,
  Grid3X3,
  Home,
  Menu,
  MessageCircle,
  Package,
  Palette,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
  X
} from "lucide-react";

const linkGroups = [
  {
    title: "Control",
    links: [
      { path: "", label: "Dashboard", icon: BarChart3 },
      { path: "/logs", label: "Actividad", icon: Activity },
      { path: "/documentacion", label: "Guia del panel", icon: BookOpen },
      { path: "?tab=notifications", label: "Notificaciones", icon: Bell }
    ]
  },
  {
    title: "Operacion comercial",
    links: [
      { path: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { path: "/pagos", label: "Pagos", icon: CreditCard },
      { path: "/tickets", label: "Tickets", icon: FileText },
      { path: "/arrepentimientos", label: "Arrepentimientos", icon: RotateCcw },
      { path: "/clientes", label: "Clientes", icon: Users },
      { path: "/chats", label: "Chats", icon: MessageCircle }
    ]
  },
  {
    title: "Catalogo",
    links: [
      { path: "/productos", label: "Productos", icon: Package },
      { path: "/categorias", label: "Categorias", icon: Grid3X3 },
      { path: "/productos?view=inventario", label: "Inventario", icon: Package }
    ]
  },
  {
    title: "Sistema",
    links: [
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
      <aside className={`admin-sidebar ${mobileOpen ? "is-open" : ""}`} id="admin-primary-navigation">
        <Link className="admin-sidebar__brand" href={normalizedAdminPath} onClick={() => setMobileOpen(false)}>
          <span>
            <Image src="/logoFZAC.jpg" alt="FZAC" width={58} height={58} unoptimized />
          </span>
          <strong>FZAC Materiales</strong>
          <small>Panel comercial</small>
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
                >
                  <Icon size={18} /> {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
