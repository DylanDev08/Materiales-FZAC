import { AdminLogsView } from "@/components/admin/admin-logs-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminLogRows } from "@/lib/db/admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminLogRows();

  return (
    <AdminShell title="Logs del sistema">
      <AdminLogsView rows={rows} />
    </AdminShell>
  );
}
