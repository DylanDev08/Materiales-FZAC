import { AdminProfitability } from "@/components/admin/admin-profitability";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getProfitabilityOverview, type ProfitabilityPeriod } from "@/lib/analytics/profitability";

function normalizePeriod(value: string | undefined): ProfitabilityPeriod {
  return value === "day" || value === "week" || value === "month" ? value : "month";
}

export default async function Page({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await requireAdmin();
  const period = normalizePeriod((await searchParams).period);
  const data = await getProfitabilityOverview(period);
  return (
    <AdminShell title="Rentabilidad" description="Relacioná ventas pagadas, costos de compra y gastos sin alterar la operación.">
      <AdminProfitability data={data} />
    </AdminShell>
  );
}
