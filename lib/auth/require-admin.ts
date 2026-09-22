import "server-only";

import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth/get-user";
import { getAdminConsolePath } from "@/lib/utils/env";
import { hasAdminAal2, isAdminMfaEnforcementReady } from "@/lib/auth/admin-mfa";

export async function requireAdminIdentity() {
  const profile = await getUserProfile();

  if (!profile) redirect(`/login?next=${encodeURIComponent(getAdminConsolePath())}`);
  if (profile.role !== "ADMIN") redirect("/cuenta");

  return profile;
}

export async function requireAdmin() {
  const profile = await requireAdminIdentity();
  const [mfaReady, aal2] = await Promise.all([
    isAdminMfaEnforcementReady(),
    hasAdminAal2()
  ]);

  if (mfaReady && !aal2) {
    redirect(`/seguridad/admin-mfa?next=${encodeURIComponent(getAdminConsolePath())}`);
  }

  return profile;
}

export async function requireUser() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
