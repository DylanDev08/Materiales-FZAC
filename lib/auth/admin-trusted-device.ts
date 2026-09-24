import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export const ADMIN_TRUST_COOKIE = "fzac_admin_trusted";
export const ADMIN_TRUST_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function currentUserAgentHash() {
  const requestHeaders = await headers();
  return sha256(requestHeaders.get("user-agent") ?? "unknown");
}

export async function hasTrustedAdminDevice(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TRUST_COOKIE)?.value?.trim();
  if (!token || token.length < 32) return false;

  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const now = new Date().toISOString();
  const userAgentHash = await currentUserAgentHash();
  const { data, error } = await admin
    .from("admin_trusted_devices")
    .select("id,user_agent_hash,expires_at")
    .eq("user_id", userId)
    .eq("token_hash", sha256(token))
    .is("revoked_at", null)
    .gt("expires_at", now)
    .maybeSingle();

  if (error || !data || data.user_agent_hash !== userAgentHash) return false;

  try {
    await admin
      .from("admin_trusted_devices")
      .update({ last_used_at: now })
      .eq("id", data.id);
  } catch {
    // Last-used bookkeeping must never block an otherwise valid trusted browser.
  }

  return true;
}

export async function createTrustedAdminDevice(userId: string, userAgent: string | null) {
  const admin = getSupabaseAdminClient();
  if (!admin) throw new Error("TRUSTED_DEVICE_BACKEND_UNAVAILABLE");

  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const userAgentHash = sha256(userAgent ?? "unknown");
  const expiresAt = new Date(Date.now() + ADMIN_TRUST_MAX_AGE_SECONDS * 1000).toISOString();
  const now = new Date().toISOString();

  try {
    await admin
      .from("admin_trusted_devices")
      .delete()
      .eq("user_id", userId)
      .lt("expires_at", now);
  } catch {
    // Expired-row cleanup is best effort.
  }

  const { data, error } = await admin
    .from("admin_trusted_devices")
    .insert({
      user_id: userId,
      token_hash: tokenHash,
      user_agent_hash: userAgentHash,
      expires_at: expiresAt
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("TRUSTED_DEVICE_CREATE_FAILED");

  const { error: auditError } = await admin.from("admin_audit_logs").insert({
    actor_id: userId,
    actor_role: "ADMIN",
    action: "ADMIN_TRUSTED_BROWSER_CREATED",
    entity: "admin_trusted_devices",
    entity_id: data.id,
    message: "Se confió este navegador por 7 días después de validar MFA.",
    metadata: { expires_at: expiresAt }
  });

  if (auditError) {
    try {
      await admin.from("admin_trusted_devices").delete().eq("id", data.id);
    } catch {
      // The caller still receives failure and no cookie is issued.
    }
    throw new Error("TRUSTED_DEVICE_AUDIT_FAILED");
  }

  return { token, expiresAt };
}

export async function revokeCurrentTrustedAdminDevice(userId: string) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TRUST_COOKIE)?.value?.trim();
  if (!token) return;

  const admin = getSupabaseAdminClient();
  if (!admin) return;

  await admin
    .from("admin_trusted_devices")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("token_hash", sha256(token));
}
