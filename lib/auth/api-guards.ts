import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";
import { hasAdminSessionAssurance } from "@/lib/auth/admin-mfa";

export async function getApiAdmin() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  if (!(await hasAdminSessionAssurance())) return null;
  return profile;
}
