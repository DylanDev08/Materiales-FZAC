import { AdminDataTable } from "@/components/admin/admin-data-table";
import { getAdminRows } from "@/lib/db/admin";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  const rows = (await getAdminRows("chat_conversations")).map((chat) => ({
    Asunto: chat.subject,
    Estado: chat.status,
    Canal: chat.channel,
    UltimoMensaje: chat.last_message_at,
    Creado: chat.created_at
  }));

  return <AdminDataTable title="Chats" columns={["Asunto", "Estado", "Canal", "UltimoMensaje", "Creado"]} rows={rows} />;
}
