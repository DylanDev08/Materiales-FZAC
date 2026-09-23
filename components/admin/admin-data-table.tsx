import { AdminShell } from "@/components/admin/admin-shell";
import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";

function adminTableDescription(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("pago")) return "Control de cobros, transferencias, Mercado Pago y comprobantes sin datos técnicos expuestos.";
  if (normalized.includes("ticket")) return "Tickets y comprobantes generados según el estado real del pago y su aprobación.";
  if (normalized.includes("chat")) return "Conversaciones y solicitudes que requieren seguimiento de FZAC.";
  if (normalized.includes("categoría") || normalized.includes("categoria")) return "Organización del catálogo para que el cliente encuentre materiales rápido.";
  if (normalized.includes("ajuste")) return "Configuración operativa del e-commerce.";
  if (normalized.includes("arrepentimiento")) return "Solicitudes de consumidores, seguimiento y resolución sin ejecutar reembolsos automáticos.";
  return "Listado administrativo con filtros, búsqueda, exportación y detalle seguro.";
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
