import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseConfig } from "@/lib/supabase/config";

type SupabaseServerClientOptions = {
  sessionOnly?: boolean;
};

export async function getSupabaseServerClient(options: SupabaseServerClientOptions = {}) {
  const config = getSupabaseConfig();
  if (!config.hasPublicConfig) return null;

  const cookieStore = await cookies();

  return createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: Parameters<typeof cookieStore.set>[2];
        }>
      ) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            if (options.sessionOnly && value) {
              const { maxAge: _maxAge, expires: _expires, ...sessionOptions } = cookieOptions;
              cookieStore.set(name, value, sessionOptions);
              return;
            }
            cookieStore.set(name, value, cookieOptions);
          });
        } catch {
          // Server Components cannot mutate cookies. The proxy refreshes and
          // persists the session before rendering, so this write can be ignored.
        }
      }
    }
  });
}
