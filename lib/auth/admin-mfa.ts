import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminMfaSatisfied } from "@/lib/auth/admin-mfa-policy";

export type AdminMfaStatus = {
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedTotpFactors: number;
};

export async function getAdminMfaStatus(): Promise<AdminMfaStatus | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const [assurance, factors] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors()
  ]);
  if (assurance.error || factors.error) return null;

  return {
    currentLevel: assurance.data.currentLevel,
    nextLevel: assurance.data.nextLevel,
    verifiedTotpFactors: factors.data.totp.filter((factor) => factor.status === "verified").length
  };
}

export async function hasAdminAal2(role: string | null | undefined = "ADMIN") {
  const status = await getAdminMfaStatus();
  return isAdminMfaSatisfied(role, status?.currentLevel);
}
