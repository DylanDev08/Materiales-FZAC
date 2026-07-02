import { NextResponse } from "next/server";
import { getUserProfile } from "@/lib/auth/get-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/utils/env";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/cuenta";
  const supabase = await getSupabaseServerClient();

  if (code && supabase) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const profile = await getUserProfile();
  const target = profile?.role === "ADMIN" ? "/admin" : next;
  return NextResponse.redirect(new URL(target, getSiteUrl()));
}
