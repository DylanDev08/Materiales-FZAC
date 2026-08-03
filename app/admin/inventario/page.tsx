import { AdminInventoryForecast } from "@/components/admin/admin-inventory-forecast";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

export default async function Page() {
  await requireAdmin();
  return <AdminShell title="Inventario" description="Demanda confirmada, cobertura y prioridades de reposición.">
    <AdminInventoryForecast adminPath={getAdminConsolePath()} />
  </AdminShell>;
}
