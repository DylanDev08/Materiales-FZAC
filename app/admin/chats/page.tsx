import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const statusLabels: Record<string, string> = {
    OPEN: "En conversación",
    WAITING_ADMIN: "Requiere atención",
    RESOLVED: "Resuelto",
    CLOSED: "Cerrado"
  };
  const rows = (await getAdminRows("chat_conversations")).map((chat) => ({
    Asunto: chat.subject,
    Estado: statusLabels[String(chat.status)] ?? "En seguimiento",
    Canal: chat.channel === "AI" ? "Asistente FZAC" : "Atención FZAC",
    "Último mensaje": chat.updated_at ?? chat.created_at,
    Creado: chat.created_at
  }));

  return <AdminDataTable title="Chats" columns={["Asunto", "Estado", "Canal", "Último mensaje", "Creado"]} rows={rows} />;
}
