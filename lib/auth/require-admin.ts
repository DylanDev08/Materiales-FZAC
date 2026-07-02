import "server-only";

import { redirect } from "next/navigation";
import { getUserProfile } from "@/lib/auth/get-user";

export async function requireAdmin() {
  const profile = await getUserProfile();

  if (!profile) redirect("/login?next=/admin");
  if (profile.role !== "ADMIN") redirect("/cuenta");

  return profile;
}

export async function requireUser() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  return profile;
}
