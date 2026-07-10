import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminRows } from "@/lib/db/admin";
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
  const rows = (await getAdminRows("purchase_tickets")).map((ticket) => ({
    Numero: ticket.number,
    Cliente: ticket.customer_name,
    Email: ticket.customer_email,
    Total: currency(ticket.total),
    Estado: ticketStatus(ticket.status)
  }));

  return <AdminDataTable title="Tickets" columns={["Numero", "Cliente", "Email", "Total", "Estado"]} rows={rows} />;
}
