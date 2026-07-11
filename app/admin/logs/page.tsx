import { AdminLogsView } from "@/components/admin/admin-logs-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminLogRows } from "@/lib/db/admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminLogRows();

  return (
    <AdminShell title="Actividad" description="Historial humano de eventos importantes, pagos, pedidos, stock y soporte.">
      <AdminLogsView rows={rows} />
    </AdminShell>
  );
}
