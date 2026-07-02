import { hasRealValue } from "@/lib/utils/env";

export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  return {
    url,
    anonKey,
    serviceRoleKey,
    hasPublicConfig: hasRealValue(url) && hasRealValue(anonKey),
    hasServiceRole: hasRealValue(url) && hasRealValue(serviceRoleKey)
  };
}
