import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/auth/admin";
import type { UserRole } from "@/types/domain";

export type SessionProfile = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
};

export async function getCurrentUser() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  return data.user;
}

export async function getUserProfile(): Promise<SessionProfile | null> {
  const user = await getCurrentUser();
  if (!user?.email) return null;

  const admin = getSupabaseAdminClient();
  const role: UserRole = isAdminEmail(user.email) ? "ADMIN" : "USER";

  if (!admin) {
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      phone: user.phone ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      role
    };
  }

  const payload = {
    id: user.id,
    email: user.email,
    full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
    phone: user.phone ?? null,
    avatar_url: user.user_metadata?.avatar_url ?? null,
    role,
    last_login_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await admin.from("profiles").upsert(payload, { onConflict: "id" });

  if (role === "ADMIN") {
    await admin.from("notifications").insert({
      target_role: "ADMIN",
      type: "ADMIN_LOGIN",
      title: "Administrador logueado",
      message: `${user.email} ingreso al panel o a la cuenta FZAC.`,
      link_to: "/admin/clientes"
    });
  }

  const { data } = await admin
    .from("profiles")
    .select("id,email,full_name,phone,avatar_url,role")
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return payload;

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    phone: data.phone,
    avatar_url: data.avatar_url,
    role: isAdminEmail(data.email) ? "ADMIN" : data.role
  };
}
