import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminPaymentTableRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminPaymentTableRows();

  return (
    <AdminDataTable
      title="Pagos"
      columns={["Estado", "Ambiente", "Proveedor", "Monto", "Referencia", "Preferencia", "PagoProveedor", "Cliente", "Email", "Fecha"]}
      rows={rows}
    />
  );
}
