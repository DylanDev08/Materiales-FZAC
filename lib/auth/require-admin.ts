import "server-only";

import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth/get-user";
import { hasAdminAal2 } from "@/lib/auth/admin-mfa";
import { getAdminConsolePath } from "@/lib/utils/env";

export async function requireAdmin() {
  const profile = await getUserProfile();

  if (!profile) redirect(`/login?next=${encodeURIComponent(getAdminConsolePath())}`);
  if (profile.role !== "ADMIN") redirect("/cuenta");

  return profile;
}

export async function requireAdminMfa() {
  const profile = await requireAdmin();
  if (!(await hasAdminAal2(profile.role))) redirect("/seguridad-admin");
  return profile;
}

export async function requireUser() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
