import "server-only";

import {
  createCipheriv,
  createECDH,
  createHmac,
  createPrivateKey,
  randomBytes,
  sign
} from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEnv, hasRealValue } from "@/lib/utils/env";

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type AdminPushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

function toBase64Url(value: Buffer | Uint8Array) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(normalized + padding, "base64");
}

function hmac(key: Buffer, data: Buffer) {
  return createHmac("sha256", key).update(data).digest();
}

function hkdfExpand(prk: Buffer, info: Buffer, length: number) {
  const blocks: Buffer[] = [];
  let previous = Buffer.alloc(0);
  let counter = 1;

  while (Buffer.concat(blocks).length < length) {
    previous = hmac(prk, Buffer.concat([previous, info, Buffer.from([counter])]));
    blocks.push(previous);
    counter += 1;
  }

  return Buffer.concat(blocks).subarray(0, length);
}

type VapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
  configured: boolean;
};

async function vapidConfig(): Promise<VapidConfig> {
  const envPublicKey = getEnv("WEB_PUSH_VAPID_PUBLIC_KEY");
  const envPrivateKey = getEnv("WEB_PUSH_VAPID_PRIVATE_KEY");
  const envSubject = getEnv("WEB_PUSH_VAPID_SUBJECT");

  if (hasRealValue(envPublicKey) && hasRealValue(envPrivateKey)) {
    const subject = hasRealValue(envSubject) ? envSubject : "mailto:fortalezaconstruccionesrosario@gmail.com";
    return {
      publicKey: envPublicKey,
      privateKey: envPrivateKey,
      subject,
      configured: true
    };
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { publicKey: "", privateKey: "", subject: "", configured: false };
  }

  const { data, error } = await admin.rpc("get_admin_web_push_config");
  if (error || !data || typeof data !== "object") {
    return { publicKey: "", privateKey: "", subject: "", configured: false };
  }

  const row = data as Record<string, unknown>;
  const publicKey = String(row.publicKey ?? "");
  const privateKey = String(row.privateKey ?? "");
  const subject = String(row.subject ?? "") || "mailto:fortalezaconstruccionesrosario@gmail.com";

  return {
    publicKey,
    privateKey,
    subject,
    configured: hasRealValue(publicKey) && hasRealValue(privateKey) && hasRealValue(subject)
  };
}

export async function getAdminPushPublicConfig() {
  const config = await vapidConfig();
  return {
    configured: config.configured,
    publicKey: config.configured ? config.publicKey : ""
  };
}

function createVapidAuthorization(endpoint: string, privateKeyRaw: Buffer, publicKeyRaw: Buffer, subject: string) {
  const audience = new URL(endpoint).origin;
  const now = Math.floor(Date.now() / 1000);
  const header = toBase64Url(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = toBase64Url(Buffer.from(JSON.stringify({ aud: audience, exp: now + 12 * 60 * 60, sub: subject })));
  const unsigned = `${header}.${payload}`;

  const x = toBase64Url(publicKeyRaw.subarray(1, 33));
  const y = toBase64Url(publicKeyRaw.subarray(33, 65));
  const d = toBase64Url(privateKeyRaw);
  const key = createPrivateKey({
    key: { kty: "EC", crv: "P-256", x, y, d },
    format: "jwk"
  });

  const signature = sign("sha256", Buffer.from(unsigned), {
    key,
    dsaEncoding: "ieee-p1363"
  });

  return `vapid t=${unsigned}.${toBase64Url(signature)}, k=${toBase64Url(publicKeyRaw)}`;
}

function encryptPayload(subscription: Pick<PushSubscriptionRow, "p256dh" | "auth">, payload: Buffer) {
  const userPublicKey = fromBase64Url(subscription.p256dh);
  const authSecret = fromBase64Url(subscription.auth);
  if (userPublicKey.length !== 65 || userPublicKey[0] !== 4) throw new Error("INVALID_PUSH_PUBLIC_KEY");
  if (authSecret.length < 16) throw new Error("INVALID_PUSH_AUTH_SECRET");

  const sender = createECDH("prime256v1");
  sender.generateKeys();
  const senderPublicKey = sender.getPublicKey();
  const sharedSecret = sender.computeSecret(userPublicKey);

  const prkKey = hmac(authSecret, sharedSecret);
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "utf8"),
    userPublicKey,
    senderPublicKey
  ]);
  const ikm = hkdfExpand(prkKey, keyInfo, 32);

  const salt = randomBytes(16);
  const prk = hmac(salt, ikm);
  const cek = hkdfExpand(prk, Buffer.from("Content-Encoding: aes128gcm\0", "utf8"), 16);
  const nonce = hkdfExpand(prk, Buffer.from("Content-Encoding: nonce\0", "utf8"), 12);

  const plaintext = Buffer.concat([payload, Buffer.from([2])]);
  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const header = Buffer.concat([
    salt,
    recordSize,
    Buffer.from([senderPublicKey.length]),
    senderPublicKey
  ]);

  return Buffer.concat([header, ciphertext]);
}

async function deliver(subscription: PushSubscriptionRow, payload: AdminPushPayload, config: VapidConfig) {
  if (!config.configured) return { ok: false as const, disabled: true as const };

  const privateKey = fromBase64Url(config.privateKey);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(privateKey);
  const publicKey = ecdh.getPublicKey();

  if (toBase64Url(publicKey) !== config.publicKey) throw new Error("VAPID_KEY_MISMATCH");

  const body = encryptPayload(subscription, Buffer.from(JSON.stringify(payload), "utf8"));
  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: createVapidAuthorization(subscription.endpoint, privateKey, publicKey, config.subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: "300",
      Urgency: "high"
    },
    body
  });

  return { ok: response.ok, status: response.status };
}

export async function sendAdminWebPush(
  payload: AdminPushPayload,
  options: { userIds?: string[] } = {}
) {
  const admin = getSupabaseAdminClient();
  const config = await vapidConfig();
  if (!admin || !config.configured) return { sent: 0, failed: 0, disabled: true };

  const { data: adminProfiles } = await admin.from("profiles").select("id").eq("role", "ADMIN");
  const adminIds = (adminProfiles ?? []).map((profile) => String(profile.id));
  const targetIds = options.userIds?.length
    ? adminIds.filter((id) => options.userIds?.includes(id))
    : adminIds;

  if (!targetIds.length) return { sent: 0, failed: 0, disabled: false };

  const { data, error } = await admin
    .from("admin_push_subscriptions")
    .select("id,user_id,endpoint,p256dh,auth")
    .eq("active", true)
    .in("user_id", targetIds)
    .limit(200);

  if (error || !data?.length) return { sent: 0, failed: 0, disabled: false };

  let sent = 0;
  let failed = 0;
  const staleIds: string[] = [];

  await Promise.all(
    (data as PushSubscriptionRow[]).map(async (subscription) => {
      try {
        const result = await deliver(subscription, payload, config);
        if (result.ok) {
          sent += 1;
          return;
        }
        failed += 1;
        if ("status" in result && (result.status === 404 || result.status === 410)) staleIds.push(subscription.id);
      } catch (error) {
        failed += 1;
        console.error("[admin.push.delivery]", {
          message: error instanceof Error ? error.message : "Push delivery failed",
          subscription_id: subscription.id
        });
      }
    })
  );

  if (staleIds.length) {
    await admin
      .from("admin_push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .in("id", staleIds);
  }

  return { sent, failed, disabled: false };
}
