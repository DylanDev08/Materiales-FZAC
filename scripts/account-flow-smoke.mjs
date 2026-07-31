import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const isLocal = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl);
if (!isLocal && process.env.ALLOW_REMOTE_ACCOUNT_QA !== "true") {
  throw new Error("Remote account QA is disabled. Set ALLOW_REMOTE_ACCOUNT_QA=true explicitly.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const primaryEmail = `qa-account-${suffix}@example.com`;
const secondaryEmail = `qa-account-owner-${suffix}@example.com`;
const password = `FzacAccount${crypto.randomBytes(12).toString("hex")}9!`;
const userIds = [];
let ownAddressId = null;
let foreignAddressId = null;
let browser = null;
const screenshotDirectory = path.join(process.cwd(), "test-results");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function cookieHeader(response) {
  const values =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie")].filter(Boolean);
  return values.map((value) => value.split(";", 1)[0]).join("; ");
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function api(path, { method = "GET", cookies = "", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookies ? { Cookie: cookies } : {}),
      Origin: baseUrl
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { response, body: await readJson(response) };
}

async function createUser(email, name) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name }
  });
  if (error || !data.user) throw new Error("Could not create an isolated account QA user.");
  userIds.push(data.user.id);
  return data.user;
}

async function cleanup() {
  const errors = [];
  if (browser) await browser.close().catch(() => errors.push("Could not close the account QA browser."));
  if (ownAddressId || foreignAddressId) {
    const { error } = await admin
      .from("addresses")
      .delete()
      .in("id", [ownAddressId, foreignAddressId].filter(Boolean));
    if (error) errors.push("Could not remove isolated QA addresses.");
  }
  for (const userId of userIds) {
    const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
    const { error: userError } = await admin.auth.admin.deleteUser(userId);
    if (profileError || userError) errors.push("Could not remove an isolated QA user.");
  }
  if (errors.length) throw new Error(errors.join(" "));
}

let testError;
let result;

try {
  const primary = await createUser(primaryEmail, "FZAC Account QA");
  const secondary = await createUser(secondaryEmail, "FZAC Other Owner QA");

  const anonymousCreate = await api("/api/account/addresses", {
    method: "POST",
    body: {
      label: "Casa",
      street: "O'Higgins",
      number: "1200",
      apartment: "",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      notes: ""
    }
  });
  assert(anonymousCreate.response.status === 401, "Anonymous address creation was not rejected.");

  const login = await api("/api/auth/login", {
    method: "POST",
    body: { email: primaryEmail, password }
  });
  assert(login.response.status === 200 && login.body.target === "/cuenta", "Account QA login failed.");
  const cookies = cookieHeader(login.response);
  assert(Boolean(cookies), "Account QA login did not issue a session cookie.");

  const invalidRegistration = await api("/api/auth/register", {
    method: "POST",
    body: {
      name: "<script>alert(1)</script>",
      phone: "123",
      email: "invalid",
      password: "weak",
      confirmPassword: "different",
      acceptedTerms: false
    }
  });
  assert(invalidRegistration.response.status === 422, "Invalid manual registration was not rejected.");

  const invalidAddress = await api("/api/account/addresses", {
    method: "POST",
    cookies,
    body: {
      label: "Casa",
      street: "<script>alert(1)</script>",
      number: "1200",
      apartment: "",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      notes: "Entrega normal"
    }
  });
  assert(invalidAddress.response.status === 422, "Unsafe address text was not rejected.");

  const createdAddress = await api("/api/account/addresses", {
    method: "POST",
    cookies,
    body: {
      label: "Casa",
      street: "O'Higgins",
      number: "1200",
      apartment: "2 B",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      notes: "Tocar timbre"
    }
  });
  assert(createdAddress.response.status === 201 && createdAddress.body.id, "Valid address creation failed.");
  ownAddressId = String(createdAddress.body.id);

  const { data: foreignAddress, error: foreignAddressError } = await admin
    .from("addresses")
    .insert({
      user_id: secondary.id,
      label: "Trabajo",
      street: "Cordoba",
      number: "900",
      city: "Rosario",
      province: "Santa Fe",
      postal_code: "2000"
    })
    .select("id")
    .single();
  if (foreignAddressError || !foreignAddress) throw new Error("Could not create the ownership-control fixture.");
  foreignAddressId = String(foreignAddress.id);

  const foreignUpdate = await api("/api/account/addresses", {
    method: "PATCH",
    cookies,
    body: {
      id: foreignAddressId,
      label: "Alterada",
      street: "Cordoba",
      number: "901",
      apartment: "",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      notes: ""
    }
  });
  assert(foreignUpdate.response.status === 404, "A user could update another user's address.");

  const foreignDelete = await api("/api/account/addresses", {
    method: "DELETE",
    cookies,
    body: { id: foreignAddressId }
  });
  assert(foreignDelete.response.status === 404, "A user could delete another user's address.");

  const ownUpdate = await api("/api/account/addresses", {
    method: "PATCH",
    cookies,
    body: {
      id: ownAddressId,
      label: "Casa principal",
      street: "San Martin",
      number: "1200",
      apartment: "2 B",
      city: "Rosario",
      province: "Santa Fe",
      postalCode: "2000",
      notes: "Porton negro"
    }
  });
  assert(ownUpdate.response.status === 200, "The address owner could not update their address.");

  const invalidProfile = await api("/api/account/profile", {
    method: "PATCH",
    cookies,
    body: { full_name: "FZAC Account QA", phone: "123", avatar_url: "" }
  });
  assert(invalidProfile.response.status === 422, "Invalid profile phone was not rejected.");

  const validProfile = await api("/api/account/profile", {
    method: "PATCH",
    cookies,
    body: { full_name: "FZAC Account QA Actualizado", phone: "+54 9 341 555 0199", avatar_url: "" }
  });
  assert(validProfile.response.status === 200, "Valid profile update failed.");

  const summary = await api("/api/account/summary", { cookies });
  assert(summary.response.status === 200, "Authenticated account summary failed.");
  assert(typeof summary.body.ordersCount === "number", "Account summary returned an invalid contract.");

  const directionsPage = await fetch(`${baseUrl}/cuenta/direcciones`, {
    headers: { Cookie: cookies },
    redirect: "manual"
  });
  const directionsHtml = await directionsPage.text();
  assert(directionsPage.status === 200, "Authenticated directions page failed.");
  assert(directionsHtml.includes("Casa principal"), "Directions page omitted the saved address.");

  const { data: savedAddress, error: savedAddressError } = await admin
    .from("addresses")
    .select("user_id,label,notes")
    .eq("id", ownAddressId)
    .single();
  if (savedAddressError || !savedAddress) throw new Error("Could not verify the saved QA address.");
  assert(savedAddress.user_id === primary.id, "The saved address has an unexpected owner.");
  assert(savedAddress.label === "Casa principal" && savedAddress.notes === "Porton negro", "Address update was not persisted.");

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,full_name,phone")
    .eq("id", primary.id)
    .single();
  if (profileError || !profile) throw new Error("Could not verify the updated QA profile.");
  assert(profile.role !== "ADMIN", "Profile update escalated the user's role.");
  assert(profile.full_name === "FZAC Account QA Actualizado", "Profile update was not persisted.");

  browser = await chromium.launch({ headless: true });
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await desktopContext.addCookies(
    cookies.split("; ").map((pair) => {
      const separator = pair.indexOf("=");
      return { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: baseUrl };
    })
  );
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${baseUrl}/cuenta/ajustes`, { waitUntil: "domcontentloaded" });
  await desktopPage.locator(".account-settings-form").waitFor({ state: "visible", timeout: 20_000 });
  await fs.mkdir(screenshotDirectory, { recursive: true });
  await desktopPage.screenshot({ path: path.join(screenshotDirectory, "desktop-account-settings.png"), fullPage: true });

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  await mobileContext.addCookies(
    cookies.split("; ").map((pair) => {
      const separator = pair.indexOf("=");
      return { name: pair.slice(0, separator), value: pair.slice(separator + 1), url: baseUrl };
    })
  );
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto(`${baseUrl}/cuenta/ajustes`, { waitUntil: "domcontentloaded" });
  await mobilePage.locator(".account-settings-form").waitFor({ state: "visible", timeout: 20_000 });
  const accountMobileMetrics = await mobilePage.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  assert(accountMobileMetrics.documentWidth <= accountMobileMetrics.viewport + 2, "Account settings generate horizontal overflow.");
  await mobilePage.screenshot({ path: path.join(screenshotDirectory, "mobile-account-settings.png"), fullPage: true });
  await desktopContext.close();
  await mobileContext.close();

  const existingEmailCheck = await api("/api/auth/email-exists", {
    method: "POST",
    body: { email: primaryEmail }
  });
  const missingEmailCheck = await api("/api/auth/email-exists", {
    method: "POST",
    body: { email: `missing-${suffix}@example.com` }
  });
  assert(existingEmailCheck.response.status === 200 && missingEmailCheck.response.status === 200, "Email privacy checks failed.");
  assert(
    JSON.stringify(existingEmailCheck.body) === JSON.stringify(missingEmailCheck.body),
    "Email existence endpoint can enumerate accounts."
  );

  const ownDelete = await api("/api/account/addresses", {
    method: "DELETE",
    cookies,
    body: { id: ownAddressId }
  });
  assert(ownDelete.response.status === 200, "The address owner could not delete their address.");
  ownAddressId = null;

  result = {
    ok: true,
    baseUrl,
    authenticated: true,
    registrationValidation: true,
    profileValidation: true,
    profileRolePreserved: true,
    addressCrud: true,
    addressOwnership: true,
    unsafeAddressRejected: true,
    accountSummary: true,
    accountSettingsResponsive: true,
    emailEnumerationBlocked: true
  };
} catch (error) {
  testError = error;
} finally {
  try {
    await cleanup();
  } catch (cleanupError) {
    if (testError) throw new AggregateError([testError, cleanupError], "Account QA and cleanup both failed.");
    throw cleanupError;
  }
}

if (testError) throw testError;
console.log(JSON.stringify({ ...result, cleanup: true }));
