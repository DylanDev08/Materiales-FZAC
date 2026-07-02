import { AdminCustomersView } from "@/components/admin/admin-customers-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminCustomerRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminCustomerRows();

  return (
    <AdminShell title="Clientes">
      <AdminCustomersView rows={rows} />
    </AdminShell>
  );
}
