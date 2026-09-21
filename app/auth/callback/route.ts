import { NextResponse } from "next/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { syncUserProfileOnLogin } from "@/lib/auth/get-user";
import { createLegalAcceptance, legalAcceptanceUserMetadata } from "@/lib/legal/versions";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getAdminConsolePath, getRequestSiteUrl } from "@/lib/utils/env";
import { safeInternalPath } from "@/lib/utils/navigation";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requestedNext = requestUrl.searchParams.get("next");
  const legalRegistration = requestUrl.searchParams.get("legal") === "register";
  const next = safeInternalPath(requestedNext);
  const siteUrl = getRequestSiteUrl(request);
  const supabase = await getSupabaseServerClient();

  if (!code || !supabase) return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?auth_error=true", siteUrl));

  const { data } = await supabase.auth.getUser();
  const authUser = data.user;
  const hasLegalAcceptance = authUser?.user_metadata?.legal_terms_accepted === true;

  if (authUser && !legalRegistration && !hasLegalAcceptance) {
    const admin = getSupabaseAdminClient();
    const { data: existingProfile } = admin
      ? await admin.from("profiles").select("id").eq("id", authUser.id).maybeSingle()
      : { data: null };

    if (!existingProfile) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL("/registro?oauth_terms_required=true", siteUrl));
    }
  }

  if (legalRegistration && authUser && !hasLegalAcceptance) {
    const legalAcceptance = createLegalAcceptance("REGISTER_GOOGLE");
    await supabase.auth.updateUser({
      data: {
        ...authUser.user_metadata,
        ...legalAcceptanceUserMetadata(legalAcceptance)
      }
    });
    const admin = getSupabaseAdminClient();
    if (admin) {
      await admin.from("admin_audit_logs").insert({
        actor_email: authUser.email ?? null,
        actor_role: isAdminEmail(authUser.email) ? "ADMIN" : "CUSTOMER",
        action: "LEGAL_ACCEPTANCE_RECORDED",
        entity: "profiles",
        entity_id: authUser.id,
        message: "Aceptación de términos y privacidad durante el registro con Google.",
        metadata: legalAcceptance
      });
    }
  }

  const profile = await syncUserProfileOnLogin(authUser);
  const target = next === "/restablecer" ? next : profile?.role === "ADMIN" ? getAdminConsolePath() : next;
  return NextResponse.redirect(new URL(target, siteUrl));
}
