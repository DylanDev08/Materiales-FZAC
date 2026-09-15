import { AdminShell } from "@/components/admin/admin-shell";
import { AdminSupplierPriceAudit } from "@/components/admin/admin-supplier-price-audit";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  return (
    <AdminShell title="Auditoría de precios" description="Paridad privada entre precios FZAC y fuentes autorizadas de proveedores.">
      <AdminSupplierPriceAudit />
    </AdminShell>
  );
}
