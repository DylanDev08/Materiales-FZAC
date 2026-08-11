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

  if (legalRegistration) {
    const legalAcceptance = createLegalAcceptance("REGISTER_GOOGLE");
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await supabase.auth.updateUser({
        data: {
          ...data.user.user_metadata,
          ...legalAcceptanceUserMetadata(legalAcceptance)
        }
      });
      const admin = getSupabaseAdminClient();
      if (admin) {
        await admin.from("admin_audit_logs").insert({
          actor_email: data.user.email ?? null,
          actor_role: isAdminEmail(data.user.email) ? "ADMIN" : "CUSTOMER",
          action: "LEGAL_ACCEPTANCE_RECORDED",
          entity: "profiles",
          entity_id: data.user.id,
          message: "Aceptación de términos y privacidad durante el registro con Google.",
          metadata: legalAcceptance
        });
      }
    }
  }

  const profile = await syncUserProfileOnLogin();
  const target = next === "/restablecer" ? next : profile?.role === "ADMIN" ? getAdminConsolePath() : next;
  return NextResponse.redirect(new URL(target, siteUrl));
}
