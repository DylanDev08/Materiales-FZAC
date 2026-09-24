import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";
import { hasAdminAal2 } from "@/lib/auth/admin-mfa";
import { hasTrustedAdminDevice } from "@/lib/auth/admin-trusted-device";

export async function getApiAdmin() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  const elevated = await hasAdminAal2();
  if (!elevated && !(await hasTrustedAdminDevice(profile.id))) return null;
  return profile;
}
