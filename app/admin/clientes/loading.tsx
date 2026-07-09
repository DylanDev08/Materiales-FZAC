import { AdminTableSkeleton, UserDetailSkeleton } from "@/components/admin/admin-skeletons";
import { AdminShell } from "@/components/admin/admin-shell";

export default function Loading() {
  return (
    <AdminShell title="Clientes">
      <div className="admin-users-skeleton-layout">
        <AdminTableSkeleton rows={7} />
        <UserDetailSkeleton />
      </div>
    </AdminShell>
  );
}
