import { AdminDataTable } from "@/components/admin/admin-data-table";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsumerRefundRows } from "@/lib/db/admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminConsumerRefundRows();

  return (
    <AdminDataTable
      title="Arrepentimientos"
      columns={["Trámite", "Cliente", "Email", "Pedido", "Motivo", "Estado", "Contacto", "Recibido"]}
      rows={rows}
    />
  );
}
