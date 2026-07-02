import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminCategories } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = (await getAdminCategories()).map((category) => ({
    Nombre: category.name,
    Slug: category.slug,
    Activa: category.active ? "Si" : "No",
    Orden: category.sort_order ?? 0
  }));

  return <AdminDataTable title="Categorias" columns={["Nombre", "Slug", "Activa", "Orden"]} rows={rows} />;
}
