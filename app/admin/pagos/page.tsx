import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminRows } from "@/lib/db/admin";
import { currency } from "@/lib/formatters/currency";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = (await getAdminRows("payments")).map((payment) => ({
    Orden: payment.order_id,
    Provider: payment.provider,
    Estado: payment.status,
    Monto: currency(payment.amount),
    Fecha: payment.created_at
  }));

  return <AdminDataTable title="Pagos" columns={["Orden", "Provider", "Estado", "Monto", "Fecha"]} rows={rows} />;
}
