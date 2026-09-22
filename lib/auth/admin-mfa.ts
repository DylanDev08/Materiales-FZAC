import "server-only";

import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AdminMfaState = {
  available: boolean;
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
  verifiedTotpFactors: number;
};

export async function getAdminMfaState(): Promise<AdminMfaState> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { available: false, currentLevel: null, nextLevel: null, verifiedTotpFactors: 0 };
  }

  const [aalResult, factorsResult] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors()
  ]);

  if (aalResult.error || factorsResult.error) {
    return { available: false, currentLevel: null, nextLevel: null, verifiedTotpFactors: 0 };
  }

  const factors = factorsResult.data as {
    totp?: Array<{ id: string; status?: string }>;
  } | null;

  const verifiedTotpFactors = (factors?.totp ?? []).filter((factor) => factor.status === "verified").length;

  return {
    available: true,
    currentLevel: aalResult.data.currentLevel ?? null,
    nextLevel: aalResult.data.nextLevel ?? null,
    verifiedTotpFactors
  };
}

export async function hasAdminAal2() {
  const state = await getAdminMfaState();
  return state.available && state.currentLevel === "aal2";
}
