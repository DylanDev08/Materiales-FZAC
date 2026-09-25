import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const callbackPath = new URL("../../app/auth/callback/route.ts", import.meta.url);
const legalPath = new URL("../../lib/legal/versions.ts", import.meta.url);
const intentPath = new URL("../../lib/legal/oauth-intent.ts", import.meta.url);
const formPath = new URL("../../components/auth/auth-form.tsx", import.meta.url);

test("un alta Google iniciada desde login no continúa sin aceptación legal", async () => {
  const [callback, legal, intent, form] = await Promise.all([
    readFile(callbackPath, "utf8"),
    readFile(legalPath, "utf8"),
    readFile(intentPath, "utf8"),
    readFile(formPath, "utf8")
  ]);

  assert.match(callback, /pendingLegalAcceptance \|\| isFirstOAuthLogin\(user\)/);
  assert.match(callback, /legal_registration_pending: true/);
  assert.match(callback, /signOut\(\{ scope: "local" \}\)/);
  assert.match(callback, /oauth_legal_required/);
  assert.match(callback, /legal_registration_pending: false/);
  assert.doesNotMatch(callback, /searchParams\.get\("legal"\)/);
  assert.match(callback, /verifyOAuthLegalIntent/);
  assert.match(intent, /timingSafeEqual/);
  assert.match(intent, /INTENT_TTL_SECONDS = 10 \* 60/);
  assert.match(form, /fetch\("\/auth\/legal-intent", \{ method: "POST" \}\)/);
  assert.doesNotMatch(form, /legal=register/);
  assert.match(legal, /CURRENT_PRIVACY_VERSION = "2026-09-24"/);
});
