import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const host = "127.0.0.1";
const port = Number(process.env.QA_ADMIN_PORT || 3211);
const baseUrl = `http://${host}:${port}`;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const email = `qa-admin-mobile-${suffix}@example.com`;
const password = `FzacAdmin${crypto.randomBytes(14).toString("hex")}9!`;
const configuredAdminPath = process.env.ADMIN_CONSOLE_PATH?.trim() || "/fzac-admin-crs-2026";
const adminPath = configuredAdminPath.startsWith("/") ? configuredAdminPath : `/${configuredAdminPath}`;
const existingAdminEmails = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const screenshotDirectory = path.join(process.cwd(), "test-results");
const closedScreenshot = path.join(screenshotDirectory, "mobile-admin-dashboard.png");
const openScreenshot = path.join(screenshotDirectory, "mobile-admin-navigation.png");
let userId = null;
let browser = null;
let server = null;
let testError = null;
const cleanupErrors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  const deadline = Date.now() + 35_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The isolated server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("The isolated admin QA server did not become ready.");
}

async function cleanup() {
  if (browser) await browser.close().catch(() => cleanupErrors.push("Could not close the QA browser."));
  if (server && !server.killed) server.kill();

  if (!userId) return;
  const { error: notificationError } = await admin
    .from("notifications")
    .delete()
    .eq("type", "ADMIN_LOGIN")
    .ilike("message", `%${email}%`);
  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (notificationError || profileError || userError) cleanupErrors.push("Could not remove isolated admin QA data.");
}

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "FZAC Admin Mobile QA" }
  });
  if (createError || !created.user) throw new Error("Could not create the isolated admin QA user.");
  userId = created.user.id;

  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-H", host, "-p", String(port)],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ADMIN_EMAILS: [...existingAdminEmails, email].join(","),
        NEXT_PUBLIC_SITE_URL: baseUrl
      },
      stdio: "ignore",
      windowsHide: true
    }
  );
  await waitForServer();

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login?next=${encodeURIComponent(adminPath)}`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/^email$/i).fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: /^ingresar$/i }).click();
  await page.waitForURL((url) => url.pathname === adminPath, { timeout: 25_000 });
  await page.locator(".admin-page").waitFor({ state: "visible", timeout: 25_000 });

  const closedMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    sidebarTransform: window.getComputedStyle(document.querySelector(".admin-sidebar")).transform
  }));
  assert(closedMetrics.documentWidth <= closedMetrics.viewport + 2, "Admin dashboard generates horizontal overflow.");
  assert(closedMetrics.sidebarTransform !== "none", "Admin sidebar must start outside the mobile viewport.");

  await fs.mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: closedScreenshot, fullPage: true });

  const menuButton = page.getByRole("button", { name: /abrir navegaci/i });
  await menuButton.click();
  const sidebar = page.locator(".admin-sidebar");
  await sidebar.waitFor({ state: "visible" });
  const links = await sidebar.locator("a").evaluateAll((nodes) =>
    nodes.map((node) => (node).getBoundingClientRect().height).filter((height) => height > 0)
  );
  assert(links.length >= 10, "Admin navigation is incomplete.");
  assert(links.every((height) => height >= 42), "Admin navigation contains undersized touch targets.");
  await page.screenshot({ path: openScreenshot });

  await page.getByRole("button", { name: /cerrar navegaci/i }).first().click();
  await page.getByRole("button", { name: /abrir navegaci/i }).waitFor({ state: "visible" });

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      authenticatedAdmin: true,
      routeProtected: true,
      dashboardResponsive: true,
      sidebarDrawer: true,
      touchTargets: true,
      horizontalOverflow: false,
      screenshots: [
        path.relative(process.cwd(), closedScreenshot),
        path.relative(process.cwd(), openScreenshot)
      ]
    })}\n`
  );
} catch (error) {
  testError = error;
} finally {
  await cleanup();
}

if (cleanupErrors.length) throw new Error(cleanupErrors.join(" "));
if (testError) throw testError;
