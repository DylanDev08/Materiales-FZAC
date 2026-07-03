import Link from "next/link";
import { BarChart3, Bell, CreditCard, FileText, Grid3X3, MessageCircle, Package, Palette, Settings, ShoppingBag, Users } from "lucide-react";
import { getAdminConsolePath } from "@/lib/utils/env";

const links = [
  { path: "", label: "Dashboard", icon: BarChart3 },
  { path: "/productos", label: "Productos", icon: Package },
  { path: "/categorias", label: "Categorias", icon: Grid3X3 },
  { path: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { path: "/pagos", label: "Pagos", icon: CreditCard },
  { path: "/tickets", label: "Tickets", icon: FileText },
  { path: "/clientes", label: "Clientes", icon: Users },
  { path: "/chats", label: "Chats", icon: MessageCircle },
  { path: "/ajustes", label: "Ajustes", icon: Settings },
  { path: "/apariencia", label: "Apariencia", icon: Palette },
  { path: "?tab=notifications", label: "Notificaciones", icon: Bell }
];

export function AdminSidebar() {
  const adminPath = getAdminConsolePath();

  return (
    <aside className="admin-sidebar">
      <nav>
        {links.map(({ path, label, icon: Icon }) => (
          <Link key={path || "dashboard"} href={`${adminPath}${path}`}>
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
