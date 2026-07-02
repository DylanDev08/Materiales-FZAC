import { AccountShell } from "@/components/account/account-shell";
import { requireUser } from "@/lib/auth/require-admin";

export default async function Page() {
  const profile = await requireUser();
  return <AccountShell profile={profile} view="Ajustes" />;
}
