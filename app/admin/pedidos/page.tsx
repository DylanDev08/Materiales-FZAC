import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminRows } from "@/lib/db/admin";
import { currency } from "@/lib/formatters/currency";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = (await getAdminRows("orders")).map((order) => ({
    Cliente: order.customer_name,
    Email: order.customer_email,
    Estado: order.status,
    Total: currency(order.total),
    Fecha: order.created_at
  }));

  return <AdminDataTable title="Pedidos" columns={["Cliente", "Email", "Estado", "Total", "Fecha"]} rows={rows} />;
}
