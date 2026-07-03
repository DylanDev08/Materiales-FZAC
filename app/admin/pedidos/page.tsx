import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminOrderTableRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminOrderTableRows();

  return (
    <AdminDataTable
      title="Pedidos"
      columns={["Cliente", "Email", "Telefono", "Productos", "Total", "Estado", "Pago", "Envio", "Fecha"]}
      rows={rows}
    />
  );
}
