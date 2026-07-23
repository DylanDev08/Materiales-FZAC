import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { isTrustedMutationRequest } from "@/lib/utils/request-security";

type CookieOptions = {
  path?: string;
  maxAge?: number;
  domain?: string;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  httpOnly?: boolean;
  expires?: Date;
};

function applySecurityHeaders(response: NextResponse, noIndex = false, noStore = false) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(self), payment=(self)");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set("X-Permitted-Cross-Domain-Policies", "none");
  response.headers.set(
    "Content-Security-Policy-Report-Only",
    [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.mercadopago.com https://*.mercadopago.com.ar https://*.supabase.co https://accounts.google.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.mercadopago.com https://*.mercadopago.com.ar https://sdk.mercadopago.com https://www.gstatic.com https://accounts.google.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https://*.supabase.co https://lh3.googleusercontent.com https://*.googleusercontent.com https://http2.mlstatic.com https://*.mercadopago.com https://*.mercadopago.com.ar",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mercadopago.com https://*.mercadopago.com https://*.mercadopago.com.ar",
      "frame-src 'self' https://*.mercadopago.com https://*.mercadopago.com.ar https://accounts.google.com",
      "report-uri /api/security/csp-report"
    ].join("; ")
  );
  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (noIndex) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  if (noStore) response.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
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
  const isSensitivePath =
    isConsolePath ||
    ["/api/admin", "/api/account", "/api/orders", "/api/checkout", "/api/auth"].some(
      (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith(`${path}/`)
    );
  const isApiMutation =
    request.nextUrl.pathname.startsWith("/api/") && !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  const isExternalWebhook =
    request.nextUrl.pathname === "/api/webhooks/mercadopago" ||
    request.nextUrl.pathname === "/api/payments/mercadopago/webhook";

  if (isApiMutation && !isExternalWebhook && !isTrustedMutationRequest(request)) {
    return applySecurityHeaders(
      NextResponse.json({ ok: false, message: "Origen de solicitud no permitido." }, { status: 403 }),
      false,
      true
    );
  }

  if (isLegacyAdminPath) {
    const url = request.nextUrl.clone();
    url.pathname = `${adminConsolePath}${request.nextUrl.pathname.replace(/^\/admin/, "")}`;
    return applySecurityHeaders(NextResponse.redirect(url), true, true);
  }

  if (!supabaseUrl || !supabaseAnonKey || /^<.*>$/.test(supabaseAnonKey)) {
    return applySecurityHeaders(response, isConsolePath, isSensitivePath);
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
  return applySecurityHeaders(response, isConsolePath, isSensitivePath);
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
