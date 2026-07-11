import { AdminDashboardSkeleton } from "@/components/admin/admin-skeletons";
import { AdminShell } from "@/components/admin/admin-shell";

export default function Loading() {
  return (
    <AdminShell title="Dashboard" description="Resumen general de ventas, pedidos, pagos y actividad.">
      <AdminDashboardSkeleton />
    </AdminShell>
  );
}
