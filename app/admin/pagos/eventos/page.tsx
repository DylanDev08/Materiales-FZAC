import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminPaymentEventRows } from "@/lib/db/admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminPaymentEventRows();

  return (
    <AdminDataTable
      title="Comprobantes de pago"
      columns={["Estado", "Medio de pago", "Evento", "Pedido", "Error", "Recibido", "Procesado"]}
      rows={rows}
    />
  );
}
