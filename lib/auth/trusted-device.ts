import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth/get-user";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const TRUSTED_DEVICE_COOKIE = "fzac_admin_trusted_device";
const TRUSTED_DEVICE_DAYS = 14;
const MAX_TRUSTED_DEVICES = 5;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function currentUserAgentHash() {
  const requestHeaders = await headers();
  return sha256(requestHeaders.get("user-agent")?.trim() || "unknown-user-agent");
}

export async function hasTrustedAdminDevice() {
  const user = await getCurrentUser();
  if (!user?.id) return false;

  const cookieStore = await cookies();
  const token = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value?.trim();
  if (!token || token.length < 32 || token.length > 256) return false;

  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const tokenHash = sha256(token);
  const userAgentHash = await currentUserAgentHash();
  const now = new Date();

  const { data, error } = await admin
    .from("admin_trusted_devices")
    .select("id,user_id,user_agent_hash,expires_at,revoked_at,last_used_at")
    .eq("token_hash", tokenHash)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data || data.revoked_at || data.user_agent_hash !== userAgentHash) return false;

  const expiresAt = new Date(data.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    // La lectura puede ejecutarse desde Server Components, donde Next no permite
    // mutar cookies. La limpieza física se hace al crear/revocar confianza.
    return false;
  }

  const lastUsedAt = new Date(data.last_used_at);
  if (!Number.isFinite(lastUsedAt.getTime()) || now.getTime() - lastUsedAt.getTime() > 60 * 60 * 1000) {
    await admin
      .from("admin_trusted_devices")
      .update({ last_used_at: now.toISOString() })
      .eq("id", data.id);
  }

  return true;
}

export async function createTrustedAdminDevice() {
  const user = await getCurrentUser();
  if (!user?.id) return false;

  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const userAgentHash = await currentUserAgentHash();
  const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

  await admin
    .from("admin_trusted_devices")
    .delete()
    .eq("user_id", user.id)
    .lt("expires_at", new Date().toISOString());

  const { error } = await admin.from("admin_trusted_devices").insert({
    user_id: user.id,
    token_hash: tokenHash,
    user_agent_hash: userAgentHash,
    expires_at: expiresAt.toISOString()
  });
  if (error) return false;

  const { data: devices } = await admin
    .from("admin_trusted_devices")
    .select("id")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("last_used_at", { ascending: false });

  if (devices && devices.length > MAX_TRUSTED_DEVICES) {
    const staleIds = devices.slice(MAX_TRUSTED_DEVICES).map((device) => device.id);
    if (staleIds.length) {
      await admin.from("admin_trusted_devices").delete().in("id", staleIds);
    }
  }

  const cookieStore = await cookies();
  cookieStore.set(TRUSTED_DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt
  });

  return true;
}

export async function revokeCurrentTrustedAdminDevice() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TRUSTED_DEVICE_COOKIE)?.value?.trim();
  cookieStore.delete(TRUSTED_DEVICE_COOKIE);
  if (!token) return;

  const user = await getCurrentUser();
  const admin = getSupabaseAdminClient();
  if (!user?.id || !admin) return;

  await admin
    .from("admin_trusted_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("token_hash", sha256(token));
}
