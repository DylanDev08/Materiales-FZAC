import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSupplierFinance } from "@/components/admin/admin-supplier-finance";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();

  return (
    <AdminShell
      title="Cuentas por pagar"
      description="Controlá facturas, vencimientos, pagos a proveedores y cambios de costos."
    >
      <AdminSupplierFinance />
    </AdminShell>
  );
}
