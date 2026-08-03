import { AdminAssistantQuality } from "@/components/admin/admin-assistant-quality";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  return (
    <AdminShell
      title="Calidad IA"
      description="Revisa conversaciones que necesitan una decision humana antes de mejorar las respuestas del asistente."
    >
      <AdminAssistantQuality />
    </AdminShell>
  );
}
