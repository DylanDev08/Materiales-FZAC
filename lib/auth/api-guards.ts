import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";
import { hasAdminAal2, isAdminMfaEnforcementReady } from "@/lib/auth/admin-mfa";

export async function getApiAdmin() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  const mfaReady = await isAdminMfaEnforcementReady();
  if (mfaReady && !(await hasAdminAal2())) return null;
  return profile;
}
