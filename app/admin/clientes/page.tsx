import { AdminCustomersView } from "@/components/admin/admin-customers-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminCustomerRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getStoreLegalIdentity } from "@/lib/legal/store-identity";

export default async function Page() {
  await requireAdmin();
  const rows = await getAdminCustomerRows();
  const reportIdentity = getStoreLegalIdentity();

  return (
    <AdminShell title="Clientes">
      <AdminCustomersView rows={rows} reportIdentity={reportIdentity} />
    </AdminShell>
  );
}
