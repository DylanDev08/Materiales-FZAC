import "server-only";

import type { User } from "@supabase/supabase-js";
import { isSenderConfigured, sendTransactionalEmail } from "@/lib/email/sender";
import { recoveryEmailTemplate, verificationEmailTemplate } from "@/lib/email/templates";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/utils/env";

function authCallbackUrl(next: string) {
  const siteUrl = new URL(getSiteUrl());
  const callback = new URL("/auth/callback", siteUrl);
  callback.searchParams.set("next", next);
  return callback.toString();
}

function authCallbackUrlForSite(siteUrl: string, next: string) {
  const callback = new URL("/auth/callback", new URL(siteUrl));
  callback.searchParams.set("next", next);
  return callback.toString();
}

async function nativeRecoveryEmail(email: string) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return false;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: authCallbackUrl("/restablecer")
  });
  return !error;
}

export async function requestPasswordRecoveryEmail(input: { email: string; name?: string | null }) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { delivered: false, channel: "unavailable" as const };

  if (isSenderConfigured()) {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email: input.email,
      options: { redirectTo: authCallbackUrl("/restablecer") }
    });

    if (!error && data.properties?.action_link) {
      try {
        const template = recoveryEmailTemplate({ name: input.name, actionUrl: data.properties.action_link });
        await sendTransactionalEmail({ to: { email: input.email, name: input.name }, ...template });
        return { delivered: true, channel: "sender" as const };
      } catch {
        // Supabase native email is the safe fallback if Sender is temporarily unavailable.
      }
    }
  }

  return { delivered: await nativeRecoveryEmail(input.email), channel: "supabase" as const };
}

export async function createSignupWithSender(input: {
  email: string;
  password: string;
  name: string;
  phone?: string | null;
  siteUrl?: string;
}): Promise<{ user: User; channel: "sender" | "supabase" } | null> {
  if (!isSenderConfigured()) return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const redirectTo = input.siteUrl ? authCallbackUrlForSite(input.siteUrl, "/cuenta") : authCallbackUrl("/cuenta");
  const { data, error } = await admin.auth.admin.generateLink({
    type: "signup",
    email: input.email,
    password: input.password,
    options: {
      data: { full_name: input.name, phone: input.phone || null },
      redirectTo
    }
  });
  if (error || !data.user || !data.properties?.action_link) {
    throw new Error(error?.message || "No pudimos crear la cuenta.");
  }

  try {
    const template = verificationEmailTemplate({ name: input.name, actionUrl: data.properties.action_link });
    await sendTransactionalEmail({ to: { email: input.email, name: input.name }, ...template });
    return { user: data.user, channel: "sender" };
  } catch {
    const supabase = await getSupabaseServerClient();
    const { error: resendError } = supabase
      ? await supabase.auth.resend({ type: "signup", email: input.email, options: { emailRedirectTo: redirectTo } })
      : { error: new Error("Supabase no configurado.") };
    if (resendError) throw new Error("La cuenta fue creada, pero no pudimos enviar el email de verificacion.");
    return { user: data.user, channel: "supabase" };
  }
}
