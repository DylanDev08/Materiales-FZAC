"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/public-config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config.hasPublicConfig) return null;

  browserClient ??= createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
