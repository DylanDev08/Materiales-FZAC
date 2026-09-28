export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminInteractiveTable } from "@/components/admin/admin-interactive-table";
import { AdminShell } from "@/components/admin/admin-shell";
import { getAdminTicketRows } from "@/lib/db/admin";
import { currency } from "@/lib/formatters/currency";
import { requireAdmin } from "@/lib/auth/require-admin";

function ticketStatus(value: string | number | null | undefined) {
  const status = String(value ?? "").toUpperCase();
  if (["PAID", "APPROVED", "COMPLETED", "ISSUED"].includes(status)) return "Aprobado";
  if (["FAILED", "REJECTED"].includes(status)) return "Denegado";
  if (status === "CANCELLED") return "Cancelado";
  return "Pendiente";
}

export default async function Page() {
  await requireAdmin();
  const rows = (await getAdminTicketRows()).map((ticket) => ({
    Numero: ticket.number,
    Cliente: ticket.customer_name,
    Email: ticket.customer_email,
    Total: currency(ticket.total),
    Estado: ticketStatus(ticket.status)
  }));

  const approved = rows.filter((row) => row.Estado === "Aprobado").length;
  const pending = rows.filter((row) => row.Estado === "Pendiente").length;
  const denied = rows.filter((row) => row.Estado === "Denegado" || row.Estado === "Cancelado").length;

  return (
    <AdminShell title="Tickets" description="Comprobantes simples para revisar compras sin entrar al detalle técnico.">
      <section className="admin-focus-summary">
        <article><span>Total</span><strong>{rows.length}</strong><small>Tickets emitidos</small></article>
        <article className="is-success"><span>Aprobados</span><strong>{approved}</strong><small>Compras confirmadas</small></article>
        <article className="is-warning"><span>Pendientes</span><strong>{pending}</strong><small>Requieren seguimiento</small></article>
        <article className="is-danger"><span>Con problema</span><strong>{denied}</strong><small>Denegados o cancelados</small></article>
      </section>
      <AdminInteractiveTable title="Tickets" columns={["Numero", "Cliente", "Email", "Total", "Estado"]} rows={rows} />
    </AdminShell>
  );
}
