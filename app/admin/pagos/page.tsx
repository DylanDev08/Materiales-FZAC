import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminPaymentTableRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminPaymentTableRows();

  return (
    <AdminDataTable
      title="Pagos"
      columns={["Estado", "Ambiente", "Medio de pago", "Monto", "Referencia", "Cliente", "Email", "Fecha"]}
      rows={rows}
    />
  );
}
