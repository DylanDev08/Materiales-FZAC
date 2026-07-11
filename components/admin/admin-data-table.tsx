import { AdminShell } from "@/components/admin/admin-shell";
import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";

function adminTableDescription(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("pago")) return "Control de cobros, transferencias, Mercado Pago y comprobantes sin datos tecnicos expuestos.";
  if (normalized.includes("ticket")) return "Tickets y comprobantes generados segun estado real de pago y aprobacion.";
  if (normalized.includes("chat")) return "Conversaciones y solicitudes que requieren seguimiento de FZAC.";
  if (normalized.includes("categoria")) return "Organizacion del catalogo para que el cliente encuentre materiales rapido.";
  if (normalized.includes("ajuste")) return "Configuracion operativa del e-commerce.";
  return "Listado administrativo con filtros, busqueda, exportacion y detalle seguro.";
}

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
    <AdminShell title={title} description={adminTableDescription(title)}>
      <AdminInteractiveTable title={title} columns={columns} rows={rows} />
    </AdminShell>
  );
}
