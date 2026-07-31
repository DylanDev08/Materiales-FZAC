import { AdminFinancialManager } from "@/components/admin/admin-financial-manager";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminFinancialMovements } from "@/lib/db/admin";

export default async function Page() {
  await requireAdmin();
  const movements = await getAdminFinancialMovements();

  return (
    <AdminShell title="Ingresos y egresos" description="Controlá caja, gastos y ajustes sin mezclar movimientos con pagos de clientes.">
      <AdminFinancialManager available={movements.available} rows={movements.rows} />
    </AdminShell>
  );
}
