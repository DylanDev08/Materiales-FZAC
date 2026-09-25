import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { syncUserProfileOnLogin } from "@/lib/auth/get-user";
import { createLegalAcceptance, hasRecordedLegalAcceptance, isFirstOAuthLogin, legalAcceptanceUserMetadata } from "@/lib/legal/versions";
import { OAUTH_LEGAL_INTENT_COOKIE, readOAuthLegalIntentCookie, verifyOAuthLegalIntent } from "@/lib/legal/oauth-intent";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminConsolePath, getCanonicalAuthSiteUrl } from "@/lib/utils/env";
import { safeInternalPath } from "@/lib/utils/navigation";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const legalRegistration = verifyOAuthLegalIntent(readOAuthLegalIntentCookie(request.headers.get("cookie")));
  const next = safeInternalPath(requestedNext);
  const siteUrl = getCanonicalAuthSiteUrl(request);
  const supabase = await getSupabaseServerClient();

  if (!code || !supabase) return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));

  const { data: authData, error: authUserError } = await supabase.auth.getUser();
  if (authUserError || !authData.user) {
    await supabase.auth.signOut({ scope: "local" });
    return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));
  }

  const user = authData.user;
  const pendingLegalAcceptance = user.user_metadata?.legal_registration_pending === true;
  const recordedLegalAcceptance = hasRecordedLegalAcceptance(user.user_metadata as Record<string, unknown>);

  if (legalRegistration) {
    const legalAcceptance = createLegalAcceptance("REGISTER_GOOGLE");
    const legalUpdate = await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        ...legalAcceptanceUserMetadata(legalAcceptance),
        legal_registration_pending: false
      }
    });
    if (legalUpdate.error) {
      await supabase.auth.signOut({ scope: "local" });
      return NextResponse.redirect(new URL("/register?oauth_legal_error=true", siteUrl));
    }

    const admin = getSupabaseAdminClient();
    if (admin) {
      await admin.from("admin_audit_logs").insert({
        actor_email: user.email ?? null,
        actor_role: isAdminEmail(user.email) ? "ADMIN" : "CUSTOMER",
        action: "LEGAL_ACCEPTANCE_RECORDED",
        entity: "profiles",
        entity_id: user.id,
        message: "Aceptación de términos y privacidad durante el registro con Google.",
        metadata: legalAcceptance
      });
    }
  } else if (!recordedLegalAcceptance && (pendingLegalAcceptance || isFirstOAuthLogin(user))) {
    await supabase.auth.updateUser({
      data: {
        ...user.user_metadata,
        legal_registration_pending: true
      }
    });
    await supabase.auth.signOut({ scope: "local" });
    const registerUrl = new URL("/register", siteUrl);
    registerUrl.searchParams.set("oauth_legal_required", "true");
    if (requestedNext) registerUrl.searchParams.set("next", next);
    return NextResponse.redirect(registerUrl);
  }

  const profile = await syncUserProfileOnLogin();
  const target =
    next === "/restablecer"
      ? next
      : profile?.role === "ADMIN"
        ? `/seguridad/admin-mfa?next=${encodeURIComponent(getAdminConsolePath())}`
        : next;
  const response = NextResponse.redirect(new URL(target, siteUrl));
  if (legalRegistration) response.cookies.delete(OAUTH_LEGAL_INTENT_COOKIE);
  return response;
}
