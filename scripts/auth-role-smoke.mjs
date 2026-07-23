import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const isLocal = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl);
if (!isLocal && process.env.ALLOW_REMOTE_AUTH_QA !== "true") {
  throw new Error("Remote auth QA is disabled. Set ALLOW_REMOTE_AUTH_QA=true explicitly.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const email = `qa-auth-${suffix}@example.com`;
const password = `FzacQA${crypto.randomBytes(16).toString("hex")}9`;
let userId = null;

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function jsonResponse(response) {
  return response.json().catch(() => ({}));
}

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "FZAC Auth QA" }
  });
  if (createError || !created.user) throw new Error("Could not create the isolated QA user.");
  userId = created.user.id;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, password }),
    redirect: "manual"
  });
  const loginBody = await jsonResponse(login);
  if (!login.ok || loginBody.target !== "/cuenta") {
    throw new Error(`QA login failed with HTTP ${login.status}.`);
  }
  const cookies = cookieHeader(login);
  if (!cookies) throw new Error("QA login did not issue a session cookie.");

  const { data: injectedProfile, error: roleError } = await admin
    .from("profiles")
    .update({ role: "ADMIN" })
    .eq("id", userId)
    .select("role")
    .single();
  if (roleError || injectedProfile?.role !== "ADMIN") {
    throw new Error("Could not prepare the role-escalation assertion.");
  }

  const [account, metrics] = await Promise.all([
    fetch(`${baseUrl}/api/account/summary`, { headers: { Cookie: cookies } }),
    fetch(`${baseUrl}/api/admin/metrics`, { headers: { Cookie: cookies } })
  ]);
  if (!account.ok) throw new Error(`Authenticated account access failed with HTTP ${account.status}.`);
  if (![401, 403].includes(metrics.status)) {
    throw new Error(`Injected profile role reached admin API with HTTP ${metrics.status}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    login: login.status,
    account: account.status,
    admin: metrics.status,
    injectedRoleRejected: true
  }));
} finally {
  if (userId) {
    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", userId);
    const { error: userDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (profileDeleteError || userDeleteError) throw new Error("Could not clean the isolated QA user.");
  }
}
