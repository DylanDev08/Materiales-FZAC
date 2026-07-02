import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = (await getAdminRows("store_settings")).map((setting) => ({
    Clave: setting.key,
    Valor: typeof setting.value === "string" ? setting.value : JSON.stringify(setting.value ?? {}),
    Actualizado: setting.updated_at
  }));

  return <AdminDataTable title="Ajustes" columns={["Clave", "Valor", "Actualizado"]} rows={rows} />;
}
