import Link from "next/link";
import { Package, ArrowRight } from "lucide-react";
import { AdminInventoryTools } from "@/components/admin/admin-inventory-tools";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

export default async function Page() {
  await requireAdmin();
  const adminPath = getAdminConsolePath();
  return (
    <AdminShell title="Stock" description="Consultá disponibilidad y ajustá el stock comercial desde Productos.">
      <section className="admin-panel admin-simple-stock-home">
        <div>
          <span className="kicker">Gestión diaria</span>
          <h2>Stock de la tienda</h2>
          <p>Para cambiar las unidades disponibles o el estado de venta, abrí la ficha del producto. No hace falta gestionar depósitos ni transferencias para un ajuste común.</p>
        </div>
        <Link className="btn" href={`${adminPath}/productos`}>
          <Package size={17} /> Ir a productos <ArrowRight size={17} />
        </Link>
      </section>
      <AdminInventoryTools adminPath={adminPath} />
    </AdminShell>
  );
}
