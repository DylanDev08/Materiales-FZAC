import { getAdminEmails } from "@/lib/utils/env";

export function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export function getPrimaryAdminEmails() {
  return getAdminEmails();
}
