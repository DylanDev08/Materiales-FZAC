import { NextResponse } from "next/server";
import { syncUserProfileOnLogin } from "@/lib/auth/get-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminConsolePath, getRequestSiteUrl } from "@/lib/utils/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const next = requestedNext?.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/cuenta";
  const siteUrl = getRequestSiteUrl(request);
  const supabase = await getSupabaseServerClient();

  if (!code || !supabase) return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));

  const profile = await syncUserProfileOnLogin();
  const target = next === "/restablecer" ? next : profile?.role === "ADMIN" ? getAdminConsolePath() : next;
  return NextResponse.redirect(new URL(target, siteUrl));
}
