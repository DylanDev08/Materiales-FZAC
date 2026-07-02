import "server-only";

import { getUserProfile } from "@/lib/auth/get-user";

export async function getApiAdmin() {
  const profile = await getUserProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  return profile;
}
