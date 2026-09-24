import "server-only";

import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth/get-user";
import { getAdminConsolePath } from "@/lib/utils/env";
import { hasAdminSessionAssurance } from "@/lib/auth/admin-mfa";

export async function requireAdminIdentity() {
  const profile = await getUserProfile();

  if (!profile) redirect(`/login?next=${encodeURIComponent(getAdminConsolePath())}`);
  if (profile.role !== "ADMIN") redirect("/cuenta");

  return profile;
}

export async function requireAdmin() {
  const profile = await requireAdminIdentity();

  if (!(await hasAdminSessionAssurance())) {
    redirect(`/seguridad/admin-mfa?next=${encodeURIComponent(getAdminConsolePath())}`);
  }

  return profile;
}

export async function requireUser() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
