import { AdminOrdersView } from "@/components/admin/admin-orders-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminOrderTableRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminOrderTableRows();

  return (
    <AdminShell title="Pedidos">
      <AdminOrdersView rows={rows} />
    </AdminShell>
  );
}
