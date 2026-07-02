import { AdminShell } from "@/components/admin/admin-shell";

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
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, index) => (
                  <tr key={index}>
                    {columns.map((column) => (
                      <td key={column}>{row[column] ?? "-"}</td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length}>No hay registros para mostrar.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}
