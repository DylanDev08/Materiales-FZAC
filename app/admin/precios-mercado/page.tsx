import { AdminMarketPrices } from "@/components/admin/admin-market-prices";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  return (
    <AdminShell
      title="Precios de mercado"
      description="Referencias comparables para decidir precios sin modificar automaticamente el catalogo FZAC."
    >
      <AdminMarketPrices />
    </AdminShell>
  );
}
