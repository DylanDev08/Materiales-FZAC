import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";
import { hasAdminAal2 } from "@/lib/auth/admin-mfa";

export async function getApiAdmin() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  if (!(await hasAdminAal2(profile.role))) return null;
  return profile;
}
