import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const callbackPath = new URL("../../app/auth/callback/route.ts", import.meta.url);
const legalPath = new URL("../../lib/legal/versions.ts", import.meta.url);

test("un alta Google iniciada desde login no continúa sin aceptación legal", async () => {
  const [callback, legal] = await Promise.all([
    readFile(callbackPath, "utf8"),
    readFile(legalPath, "utf8")
  ]);

  assert.match(callback, /pendingLegalAcceptance \|\| isFirstOAuthLogin\(user\)/);
  assert.match(callback, /legal_registration_pending: true/);
  assert.match(callback, /signOut\(\{ scope: "local" \}\)/);
  assert.match(callback, /oauth_legal_required/);
  assert.match(callback, /legal_registration_pending: false/);
  assert.match(legal, /CURRENT_PRIVACY_VERSION = "2026-09-24"/);
});
