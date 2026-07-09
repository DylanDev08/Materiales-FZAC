import { AdminMetricSkeleton, AdminTableSkeleton } from "@/components/admin/admin-skeletons";
import { AdminShell } from "@/components/admin/admin-shell";

export default function Loading() {
  return (
    <AdminShell title="Dashboard">
      <AdminMetricSkeleton />
      <AdminTableSkeleton />
    </AdminShell>
  );
}
