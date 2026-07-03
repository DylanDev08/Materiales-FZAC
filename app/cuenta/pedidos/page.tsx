import { AccountShell } from "@/components/account/account-shell";
import { requireUser } from "@/lib/auth/require-admin";
import { getAccountOverview } from "@/lib/db/account";

export default async function Page() {
  const profile = await requireUser();
  const overview = await getAccountOverview(profile);
  return <AccountShell profile={profile} overview={overview} view="pedidos" />;
}
