import { hasRealValue } from "@/lib/utils/env";

const FZAC_SUPABASE_URL = "https://gooxgjzetziwnxhuymmx.supabase.co";
const FZAC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7DFAanJWYTfTVE8BFvbNSw_zXO_rC6Y";

export function getSupabasePublicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FZAC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || FZAC_SUPABASE_PUBLISHABLE_KEY;

  return {
    url,
    anonKey,
    hasPublicConfig: hasRealValue(url) && hasRealValue(anonKey)
  };
}
