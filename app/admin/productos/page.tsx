import { AdminProductsManager } from "@/components/admin/admin-products-manager";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminCategories, getAdminProducts } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page({ searchParams }: { searchParams?: Promise<{ product?: string | string[] }> }) {
  await requireAdmin();
  const params = searchParams ? await searchParams : {};
  const productId = Array.isArray(params.product) ? params.product[0] : params.product;
  const [products, categories] = await Promise.all([getAdminProducts(), getAdminCategories()]);

  return (
    <AdminShell title="Productos">
      <AdminProductsManager products={products} categories={categories} initialProductId={productId} />
    </AdminShell>
  );
}
