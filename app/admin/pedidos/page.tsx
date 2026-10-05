export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPaymentConfirmation } from "@/components/admin/admin-payment-confirmation";
import { AdminOrdersView } from "@/components/admin/admin-orders-view";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminAssignableUsers, getAdminOrderTableRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const [rows, assignees] = await Promise.all([getAdminOrderTableRows(), getAdminAssignableUsers()]);

  return (
    <AdminShell title="Pedidos">
      <AdminPaymentConfirmation rows={rows} />
      <AdminOrdersView rows={rows} assignees={assignees} />
    </AdminShell>
  );
}
