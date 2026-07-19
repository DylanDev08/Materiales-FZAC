import "server-only";

import { getSupabasePublicConfig } from "@/lib/supabase/public-config";
import { hasRealValue } from "@/lib/utils/env";

export function getSupabaseConfig() {
  const publicConfig = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "";

  return {
    ...publicConfig,
    serviceRoleKey,
    hasServiceRole: publicConfig.hasPublicConfig && hasRealValue(serviceRoleKey)
  };
}
