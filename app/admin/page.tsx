import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page({ searchParams }: { searchParams?: Promise<{ period?: string | string[] }> }) {
  await requireAdmin();
  const params = searchParams ? await searchParams : {};
  const period = Array.isArray(params.period) ? params.period[0] : params.period;
  return <AdminDashboard period={period} />;
}
