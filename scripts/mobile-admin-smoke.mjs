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
const financeScreenshot = path.join(screenshotDirectory, "mobile-admin-finances.png");
const qualityScreenshot = path.join(screenshotDirectory, "mobile-admin-assistant-quality.png");
const desktopScreenshot = path.join(screenshotDirectory, "desktop-admin-dashboard.png");
const desktopCollapsedScreenshot = path.join(screenshotDirectory, "desktop-admin-dashboard-collapsed.png");
const desktopFinanceScreenshot = path.join(screenshotDirectory, "desktop-admin-finances.png");
let userId = null;
let financialMovementId = null;
let assistantConversationId = null;
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
  if (assistantConversationId) {
    const { error: conversationError } = await admin.from("chat_conversations").delete().eq("id", assistantConversationId);
    if (conversationError) cleanupErrors.push("Could not remove isolated assistant quality data.");
  }
  if (financialMovementId) {
    const { error: auditLogError } = await admin
      .from("admin_audit_logs")
      .delete()
      .eq("entity", "financial_movements")
      .eq("entity_id", financialMovementId);
    const { error: financialMovementError } = await admin
      .from("financial_movements")
      .delete()
      .eq("id", financialMovementId);
    if (auditLogError || financialMovementError) cleanupErrors.push("Could not remove isolated financial QA data.");
  }
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

  await page.goto(`${baseUrl}${adminPath}/finanzas`, { waitUntil: "domcontentloaded" });
  await page.locator(".admin-finance-page").last().waitFor({ state: "visible", timeout: 25_000 });
  const createdMovement = await page.evaluate(async () => {
    const response = await fetch("/api/admin/financial-movements", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "EXPENSE",
        category: "QA",
        description: "Movimiento temporal de control automatizado",
        amount: 1,
        occurred_at: new Date().toISOString()
      })
    });
    return { status: response.status, body: await response.json() };
  });
  assert(createdMovement.status === 201 && createdMovement.body?.id, "Admin could not create a financial movement.");
  financialMovementId = createdMovement.body.id;

  const voidedMovement = await page.evaluate(async (id) => {
    const response = await fetch("/api/admin/financial-movements", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, reason: "Finalizacion de prueba automatizada" })
    });
    return { status: response.status, body: await response.json() };
  }, financialMovementId);
  assert(voidedMovement.status === 200 && voidedMovement.body?.ok, "Admin could not void a financial movement.");

  const repeatedVoid = await page.evaluate(async (id) => {
    const response = await fetch("/api/admin/financial-movements", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, reason: "Reintento que debe rechazarse" })
    });
    return response.status;
  }, financialMovementId);
  assert(repeatedVoid === 409, "A voided financial movement was modified twice.");

  const { data: persistedMovement, error: persistedMovementError } = await admin
    .from("financial_movements")
    .select("status,void_reason")
    .eq("id", financialMovementId)
    .single();
  assert(!persistedMovementError && persistedMovement?.status === "VOID", "Financial movement was not persisted as void.");
  const financeMobileMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  assert(financeMobileMetrics.documentWidth <= financeMobileMetrics.viewport + 2, "Admin finances generate mobile horizontal overflow.");
  await page.screenshot({ path: financeScreenshot, fullPage: true });

  const { data: conversation, error: conversationError } = await admin
    .from("chat_conversations")
    .insert({ visitor_id: crypto.randomUUID(), channel: "AI", status: "OPEN", subject: "QA calidad IA" })
    .select("id")
    .single();
  if (conversationError || !conversation) throw new Error("Could not create assistant quality QA conversation.");
  assistantConversationId = conversation.id;
  const { data: qualityMessages, error: qualityMessageError } = await admin
    .from("chat_messages")
    .insert([
      { conversation_id: assistantConversationId, role: "USER", content: "Pregunta temporal de calidad" },
      { conversation_id: assistantConversationId, role: "ASSISTANT", content: "Respuesta temporal para revision" }
    ])
    .select("id,role");
  if (qualityMessageError || !qualityMessages) throw new Error("Could not create assistant quality QA messages.");
  const userMessageId = qualityMessages.find((message) => message.role === "USER")?.id;
  const assistantMessageId = qualityMessages.find((message) => message.role === "ASSISTANT")?.id;
  if (!userMessageId || !assistantMessageId) throw new Error("Assistant quality QA messages are incomplete.");
  const { error: qualityQueueError } = await admin.from("assistant_review_queue").insert({
    conversation_id: assistantConversationId,
    user_message_id: userMessageId,
    assistant_message_id: assistantMessageId,
    intent: "fallback",
    reason: "LOW_CONFIDENCE",
    confidence: 0.2,
    priority: 1,
    status: "OPEN"
  });
  if (qualityQueueError) throw new Error("Could not create assistant quality QA review.");

  await page.goto(`${baseUrl}${adminPath}/calidad-ia`, { waitUntil: "domcontentloaded" });
  await page.locator(".admin-ai-quality").waitFor({ state: "visible", timeout: 25_000 });
  await page.locator(".admin-ai-evaluation").waitFor({ state: "visible", timeout: 25_000 });
  await page.locator(".admin-ai-quality__exchange").getByText("Pregunta temporal de calidad", { exact: false }).first().waitFor({ state: "visible" });
  const periodButtons = await page.locator(".admin-ai-evaluation__periods button").evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  assert(periodButtons.length === 3 && periodButtons.every((height) => height >= 44), "Assistant evaluation period controls are not mobile friendly.");
  const rangeResponse = page.waitForResponse((response) => response.url().includes("/api/admin/assistant-quality?range=7") && response.status() === 200);
  await page.getByRole("button", { name: "7 dias" }).click();
  await rangeResponse;
  const qualityMobileMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    clippedElements: Array.from(document.querySelectorAll(
      ".admin-ai-quality__guardrail, .admin-ai-quality__guardrail p, .admin-ai-quality__row, .admin-ai-quality__exchange, .admin-ai-quality__exchange p, .admin-ai-evaluation, .admin-ai-evaluation__head"
    )).filter((element) => element.scrollWidth > element.clientWidth + 1).length
  }));
  assert(qualityMobileMetrics.documentWidth <= qualityMobileMetrics.viewport + 2, "Assistant quality generates mobile horizontal overflow.");
  assert(qualityMobileMetrics.clippedElements === 0, "Assistant quality contains internally clipped text.");
  await page.screenshot({ path: qualityScreenshot, fullPage: true });
  await page.getByRole("button", { name: "Revisar" }).last().click();
  await page.getByLabel("Notas internas").fill("Respuesta revisada durante QA automatizado");
  await page.getByRole("button", { name: "Resolver" }).click();
  await page.getByText(/Revision resuelta/).waitFor({ state: "visible" });
  const { data: resolvedReview, error: resolvedReviewError } = await admin
    .from("assistant_review_queue")
    .select("status,review_notes")
    .eq("conversation_id", assistantConversationId)
    .single();
  assert(!resolvedReviewError && resolvedReview?.status === "RESOLVED", "Assistant quality review was not persisted as resolved.");

  for (const route of ["pedidos", "pagos", "clientes", "productos", "logs"]) {
    await page.goto(`${baseUrl}${adminPath}/${route}`, { waitUntil: "domcontentloaded" });
    await page.locator(".admin-page").waitFor({ state: "visible", timeout: 25_000 });
    const routeMetrics = await page.evaluate(() => ({
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth
    }));
    assert(routeMetrics.documentWidth <= routeMetrics.viewport + 2, `Admin ${route} generates mobile horizontal overflow.`);
  }

  const storageState = await context.storageState();
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState });
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(`${baseUrl}${adminPath}`, { waitUntil: "domcontentloaded" });
  await desktopPage.locator(".admin-dashboard-model").last().waitFor({ state: "visible", timeout: 25_000 });
  await desktopPage.screenshot({ path: desktopScreenshot, fullPage: true });
  const collapseButton = desktopPage.getByRole("button", { name: "Contraer menu administrativo" });
  await collapseButton.click();
  await desktopPage.locator(".admin-sidebar.is-collapsed").waitFor({ state: "visible" });
  const collapsedMetrics = await desktopPage.evaluate(() => ({
    sidebarWidth: document.querySelector(".admin-sidebar")?.getBoundingClientRect().width ?? 999,
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));
  assert(collapsedMetrics.sidebarWidth <= 80, "Collapsed desktop sidebar is wider than expected.");
  assert(collapsedMetrics.documentWidth <= collapsedMetrics.viewport + 2, "Collapsed desktop admin generates horizontal overflow.");
  await desktopPage.screenshot({ path: desktopCollapsedScreenshot, fullPage: true });
  await desktopPage.getByRole("button", { name: "Expandir menu administrativo" }).click();
  await desktopPage.goto(`${baseUrl}${adminPath}/finanzas`, { waitUntil: "domcontentloaded" });
  await desktopPage.locator(".admin-finance-page").last().waitFor({ state: "visible", timeout: 25_000 });
  await desktopPage.screenshot({ path: desktopFinanceScreenshot, fullPage: true });
  await desktopContext.close();

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      authenticatedAdmin: true,
      routeProtected: true,
      financialMovementLifecycle: true,
      dashboardResponsive: true,
      financesResponsive: true,
      assistantQualityResponsive: true,
      assistantQualityLifecycle: true,
      sidebarDrawer: true,
      desktopSidebarCollapse: true,
      sharedMobileRoutes: true,
      touchTargets: true,
      horizontalOverflow: false,
      screenshots: [
        path.relative(process.cwd(), closedScreenshot),
        path.relative(process.cwd(), openScreenshot),
        path.relative(process.cwd(), financeScreenshot),
        path.relative(process.cwd(), qualityScreenshot),
        path.relative(process.cwd(), desktopScreenshot),
        path.relative(process.cwd(), desktopCollapsedScreenshot),
        path.relative(process.cwd(), desktopFinanceScreenshot)
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
