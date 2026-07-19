import "server-only";

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAdminConsolePath } from "@/lib/utils/env";
import type { UserRole } from "@/types/domain";

export type SessionProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
};

function metadataText(metadata: Record<string, unknown> | undefined, keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return data.user;
}

function sessionProfileFromUser(user: User): SessionProfile {
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  return {
    id: user.id,
    email: user.email ?? "",
    full_name: metadataText(metadata, ["full_name", "name"]),
    phone: user.phone ?? metadataText(metadata, ["phone"]),
    avatar_url: metadataText(metadata, ["avatar_url", "picture", "photo_url"]),
    role: isAdminEmail(user.email) ? "ADMIN" : "USER"
  };
}

export const getUserProfile = cache(async (): Promise<SessionProfile | null> => {
  const user = await getCurrentUser();
  if (!user?.email) return null;

  const admin = getSupabaseAdminClient();
  const fallback = sessionProfileFromUser(user);
  if (!admin) return fallback;

  const { data } = await admin
    .from("profiles")
    .select("id,email,full_name,phone,avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return fallback;

  return {
    id: data.id,
    email: data.email || user.email,
    full_name: data.full_name ?? fallback.full_name,
    phone: data.phone ?? fallback.phone,
    avatar_url: data.avatar_url ?? fallback.avatar_url,
    role: isAdminEmail(user.email) ? "ADMIN" : "USER"
  };
});

export async function syncUserProfileOnLogin(authUser?: User | null): Promise<SessionProfile | null> {
  const user = authUser ?? (await getCurrentUser());
  if (!user?.email) return null;

  const fallback = sessionProfileFromUser(user);
  const admin = getSupabaseAdminClient();
  if (!admin) return fallback;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("full_name,phone,avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const now = new Date().toISOString();
  const payload = {
    id: user.id,
    email: user.email,
    full_name: existingProfile?.full_name ?? fallback.full_name,
    phone: existingProfile?.phone ?? fallback.phone,
    avatar_url: fallback.avatar_url ?? existingProfile?.avatar_url ?? null,
    role: fallback.role,
    last_login_at: now,
    updated_at: now
  };

  await admin.from("profiles").upsert(payload, { onConflict: "id" });

  if (fallback.role === "ADMIN") {
    await admin.from("notifications").insert({
      target_role: "ADMIN",
      type: "ADMIN_LOGIN",
      title: "Administrador logueado",
      message: `${user.email} ingreso a FZAC.`,
      link_to: `${getAdminConsolePath()}/clientes`
    });
  }

  return {
    id: payload.id,
    email: payload.email,
    full_name: payload.full_name,
    phone: payload.phone,
    avatar_url: payload.avatar_url,
    role: fallback.role
  };
}
