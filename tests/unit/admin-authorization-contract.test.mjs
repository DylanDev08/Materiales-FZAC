import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const user = source("../../lib/auth/get-user.ts");
const apiGuard = source("../../lib/auth/api-guards.ts");
const adminApi = source("../../lib/auth/admin-api.ts");
const adminMfa = source("../../lib/auth/admin-mfa.ts");

test("admin API requires role and session assurance before granting privileged client access", () => {
  assert.match(apiGuard, /profile\.role !== "ADMIN"/);
  assert.match(apiGuard, /hasAdminSessionAssurance\(\)/);
  const guardPosition = adminApi.indexOf("const profile = await getApiAdmin()");
  const privilegedPosition = adminApi.indexOf("const admin = getSupabaseAdminClient()");
  assert.ok(guardPosition >= 0 && privilegedPosition > guardPosition);
  assert.match(adminApi, /if \(!profile\) return \{ ok: false/);
});

test("identity is verified server-side and user-editable metadata cannot assign ADMIN", () => {
  assert.match(user, /supabase\.auth\.getUser\(\)/);
  const fallback = user.split("function sessionProfileFromUser")[1]?.split("export const getUserProfile")[0] ?? "";
  assert.match(fallback, /role: isAdminEmail\(user\.email\)/);
  assert.doesNotMatch(fallback, /metadata[^\n]*\[["']role["']\]/);
  assert.match(user, /\.from\("profiles"\)/);
});

test("admin MFA checks current assurance and never accepts missing MFA state", () => {
  assert.match(adminMfa, /state\.available && state\.currentLevel === "aal2"/);
  assert.match(adminMfa, /hasTrustedAdminDevice\(\)/);
  assert.match(adminApi, /getSupabaseAdminClient\(\) \?\? await getSupabaseServerClient\(\)/);
});
