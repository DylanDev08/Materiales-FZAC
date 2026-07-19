import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type CookieOptions = {
  path?: string;
  maxAge?: number;
  domain?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  expires?: Date;
};

function applySecurityHeaders(response: NextResponse, noIndex = false) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self)");
  if (noIndex) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const rawAdminPath = process.env.ADMIN_CONSOLE_PATH?.trim() || "/fzac-admin-crs-2026";
  const normalizedAdminPath = rawAdminPath.replace(/^\/+|\/+$/g, "");
  const adminConsolePath = normalizedAdminPath ? `/${normalizedAdminPath}` : "/fzac-admin-crs-2026";
  const isLegacyAdminPath = request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/");
  const isConsolePath = request.nextUrl.pathname === adminConsolePath || request.nextUrl.pathname.startsWith(`${adminConsolePath}/`);

  if (isLegacyAdminPath) {
    const url = request.nextUrl.clone();
    url.pathname = `${adminConsolePath}${request.nextUrl.pathname.replace(/^\/admin/, "")}`;
    return applySecurityHeaders(NextResponse.redirect(url), true);
  }

  if (!supabaseUrl || !supabaseAnonKey || /^<.*>$/.test(supabaseAnonKey)) {
    return applySecurityHeaders(response, isConsolePath);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request });
        response.cookies.set({ name, value: "", ...options });
      }
    }
  });

  await supabase.auth.getUser();
  return applySecurityHeaders(response, isConsolePath);
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
