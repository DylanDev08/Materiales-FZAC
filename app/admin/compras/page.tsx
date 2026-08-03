import { AdminProcurement } from "@/components/admin/admin-procurement";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAdminConsolePath } from "@/lib/utils/env";

export default async function Page({ searchParams }: { searchParams?: Promise<{ product?: string | string[] }> }) {
  await requireAdmin();
  const params = searchParams ? await searchParams : {};
  const productId = Array.isArray(params.product) ? params.product[0] : params.product;
  return (
    <AdminShell title="Compras y proveedores" description="Prepará reposiciones, enviá órdenes y recibí mercadería con trazabilidad.">
      <AdminProcurement adminPath={getAdminConsolePath()} initialProductId={productId} />
    </AdminShell>
  );
}
