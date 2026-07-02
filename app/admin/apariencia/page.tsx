import { AdminAppearance } from "@/components/admin/admin-appearance";
import { requireAdmin } from "@/lib/auth/require-admin";

export default async function Page() {
  await requireAdmin();
  return <AdminAppearance />;
}
