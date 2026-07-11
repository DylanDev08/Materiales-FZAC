import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTableSkeleton } from "@/components/admin/admin-skeletons";

export default function Loading() {
  return (
    <AdminShell title="Comprobantes de pago" description="Facturas, tickets y eventos de pago listos para revisar.">
      <AdminTableSkeleton rows={8} />
    </AdminShell>
  );
}
