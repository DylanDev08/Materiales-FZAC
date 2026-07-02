"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "@/lib/supabase/config";

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient() {
  const config = getSupabaseConfig();
  if (!config.hasPublicConfig) return null;

  browserClient ??= createBrowserClient(config.url, config.anonKey);
  return browserClient;
}
