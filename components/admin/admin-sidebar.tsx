import Link from "next/link";
import { BarChart3, Bell, CreditCard, FileText, Grid3X3, MessageCircle, Package, Palette, Settings, ShoppingBag, Users } from "lucide-react";

const links = [
  { href: "/admin", label: "Dashboard", icon: BarChart3 },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/categorias", label: "Categorias", icon: Grid3X3 },
  { href: "/admin/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/admin/pagos", label: "Pagos", icon: CreditCard },
  { href: "/admin/tickets", label: "Tickets", icon: FileText },
  { href: "/admin/clientes", label: "Clientes", icon: Users },
  { href: "/admin/chats", label: "Chats", icon: MessageCircle },
  { href: "/admin/ajustes", label: "Ajustes", icon: Settings },
  { href: "/admin/apariencia", label: "Apariencia", icon: Palette },
  { href: "/admin?tab=notifications", label: "Notificaciones", icon: Bell }
];

export function AdminSidebar() {
  return (
    <aside className="admin-sidebar">
      <nav>
        {links.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
