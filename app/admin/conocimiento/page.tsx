import { AdminAssistantKnowledge } from "@/components/admin/admin-assistant-knowledge";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  return <AdminAssistantKnowledge />;
}
