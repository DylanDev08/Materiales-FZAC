import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTableSkeleton } from "@/components/admin/admin-skeletons";

export default function Loading() {
  return (
    <AdminShell title="Pagos">
      <AdminTableSkeleton rows={8} />
    </AdminShell>
  );
}
