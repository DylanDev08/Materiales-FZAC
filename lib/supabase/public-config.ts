import { hasRealValue } from "@/lib/utils/env";

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  return {
    url,
    anonKey,
    hasPublicConfig: hasRealValue(url) && hasRealValue(anonKey)
  };
}
