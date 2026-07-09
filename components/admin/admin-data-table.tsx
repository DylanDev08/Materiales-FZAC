import { AdminShell } from "@/components/admin/admin-shell";
import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";

export function AdminDataTable({
  title,
  columns,
  rows
}: {
  title: string;
  columns: string[];
  rows: Array<Record<string, string | number | null | undefined>>;
}) {
  return (
    <AdminShell title={title}>
      <AdminInteractiveTable title={title} columns={columns} rows={rows} />
    </AdminShell>
  );
}
