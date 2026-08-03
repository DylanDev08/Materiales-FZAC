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
const marketPricesScreenshot = path.join(screenshotDirectory, "mobile-admin-market-prices.png");
const inventoryScreenshot = path.join(screenshotDirectory, "mobile-admin-inventory.png");
const desktopScreenshot = path.join(screenshotDirectory, "desktop-admin-dashboard.png");
const desktopCollapsedScreenshot = path.join(screenshotDirectory, "desktop-admin-dashboard-collapsed.png");
const desktopFinanceScreenshot = path.join(screenshotDirectory, "desktop-admin-finances.png");
const desktopMarketPricesScreenshot = path.join(screenshotDirectory, "desktop-admin-market-prices.png");
const desktopInventoryScreenshot = path.join(screenshotDirectory, "desktop-admin-inventory.png");
let userId = null;
let financialMovementId = null;
let assistantConversationId = null;
let marketProductId = null;
let marketSourceIds = [];
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
  if (marketProductId) {
    const { error: marketAuditError } = await admin.from("admin_audit_logs").delete().eq("entity", "products").eq("entity_id", marketProductId);
    const { error: marketProductError } = await admin.from("products").delete().eq("id", marketProductId);
    if (marketAuditError || marketProductError) cleanupErrors.push("Could not remove isolated market price product data.");
  }
  if (marketSourceIds.length) {
    const { error: marketSourceError } = await admin.from("market_price_sources").delete().in("id", marketSourceIds);
    if (marketSourceError) cleanupErrors.push("Could not remove isolated market price sources.");
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
  const anonymousInventoryResponse = await fetch(`${baseUrl}/api/admin/inventory/forecast`);
  assert([401, 403].includes(anonymousInventoryResponse.status), "Inventory forecast API is exposed without an admin session.");

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

  const { data: marketCategory, error: marketCategoryError } = await admin
    .from("categories")
    .select("id")
    .eq("active", true)
    .limit(1)
    .single();
  if (marketCategoryError || !marketCategory) throw new Error("Could not find a category for isolated market price QA.");
  const { data: marketProduct, error: marketProductError } = await admin.from("products").insert({
    slug: `qa-market-${suffix}`,
    sku: `QA-MARKET-${suffix}`.slice(0, 80),
    name: "Producto temporal de inteligencia de precios",
    description: "Producto aislado para validar decisiones de precio.",
    category_id: marketCategory.id,
    subcategory: "QA",
    brand: "FZAC QA",
    price: 800,
    stock: 1,
    stock_minimum: 0,
    unit: "bolsa",
    image_url: "",
    gallery: [],
    specifications: {},
    active: true
  }).select("id").single();
  if (marketProductError || !marketProduct) throw new Error("Could not create isolated market price product.");
  marketProductId = marketProduct.id;
  const { data: marketSources, error: marketSourcesError } = await admin.from("market_price_sources").insert([
    { slug: `qa-market-a-${suffix}`, name: "Fuente QA A", source_type: "MANUAL", active: true, trusted: true, created_by: userId },
    { slug: `qa-market-b-${suffix}`, name: "Fuente QA B", source_type: "MANUAL", active: true, trusted: true, created_by: userId }
  ]).select("id");
  if (marketSourcesError || !marketSources || marketSources.length !== 2) throw new Error("Could not create isolated market price sources.");
  marketSourceIds = marketSources.map((source) => source.id);
  const observedAt = new Date(Date.now() - 60_000).toISOString();
  const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
  const { error: marketObservationsError } = await admin.from("market_price_observations").insert(marketSources.map((source, index) => ({
    product_id: marketProductId,
    source_id: source.id,
    external_key: `qa-${index}-${suffix}`,
    external_name: `Producto comparable QA ${index + 1}`,
    observed_price: index ? 1050 : 1000,
    currency: "ARS",
    sale_unit: "bolsa",
    equivalent_quantity: 1,
    observed_at: observedAt,
    expires_at: expiresAt,
    fingerprint: crypto.createHash("sha256").update(`${source.id}-${suffix}`).digest("hex"),
    metadata: { origin: "QA" },
    created_by: userId
  })));
  if (marketObservationsError) throw new Error("Could not create isolated market price observations.");

  await page.goto(`${baseUrl}${adminPath}/precios-mercado`, { waitUntil: "domcontentloaded" });
  await page.locator(".admin-market-prices").last().waitFor({ state: "visible", timeout: 25_000 });
  await page.getByText("Cargando inteligencia de precios...").last().waitFor({ state: "hidden", timeout: 25_000 });
  const marketDecision = page.locator(".admin-market-prices__decision").filter({ hasText: "Producto temporal de inteligencia de precios" }).last();
  await marketDecision.waitFor({ state: "visible", timeout: 25_000 });
  const marketPriceMobileMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    undersizedActions: Array.from(document.querySelectorAll(".admin-market-prices button"))
      .filter((element) => element.getBoundingClientRect().height > 0 && element.getBoundingClientRect().height < 42).length
  }));
  assert(marketPriceMobileMetrics.documentWidth <= marketPriceMobileMetrics.viewport + 2, "Market price intelligence generates mobile horizontal overflow.");
  assert(marketPriceMobileMetrics.undersizedActions === 0, "Market price intelligence contains undersized touch actions.");
  await marketDecision.getByRole("button", { name: /Revisar/ }).click();
  await marketDecision.getByText("Confirmación de publicación").waitFor({ state: "visible" });
  await page.screenshot({ path: marketPricesScreenshot, fullPage: true });
  const marketApplyResponse = page.waitForResponse((response) => response.url().includes("/api/admin/market-prices") && response.request().method() === "POST");
  await marketDecision.getByRole("button", { name: "Aplicar precio" }).click();
  const marketApply = await marketApplyResponse;
  assert(marketApply.status() === 200, "Admin could not apply a supervised market price suggestion.");
  await page.getByText(/Precio actualizado con evidencia vigente/).waitFor({ state: "visible" });
  const { data: updatedMarketProduct, error: updatedMarketProductError } = await admin.from("products").select("price").eq("id", marketProductId).single();
  assert(!updatedMarketProductError && Number(updatedMarketProduct?.price) === 1050, "Supervised market price was not persisted.");

  await page.goto(`${baseUrl}${adminPath}/inventario`, { waitUntil: "domcontentloaded" });
  await page.locator(".admin-inventory").waitFor({ state: "visible", timeout: 25_000 });
  await page.locator(".admin-inventory__skeleton").waitFor({ state: "hidden", timeout: 25_000 });
  const inventoryMobileMetrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    undersizedActions: Array.from(document.querySelectorAll(".admin-inventory button, .admin-inventory a"))
      .filter((element) => element.getBoundingClientRect().height > 0 && element.getBoundingClientRect().height < 42).length
  }));
  assert(inventoryMobileMetrics.documentWidth <= inventoryMobileMetrics.viewport + 2, "Inventory forecast generates mobile horizontal overflow.");
  assert(inventoryMobileMetrics.undersizedActions === 0, "Inventory forecast contains undersized touch actions.");
  await page.screenshot({ path: inventoryScreenshot, fullPage: true });

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
  await desktopPage.goto(`${baseUrl}${adminPath}/precios-mercado`, { waitUntil: "domcontentloaded" });
  await desktopPage.locator(".admin-market-prices").last().waitFor({ state: "visible", timeout: 25_000 });
  await desktopPage.getByText("Cargando inteligencia de precios...").last().waitFor({ state: "hidden", timeout: 25_000 });
  const desktopMarketMetrics = await desktopPage.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert(desktopMarketMetrics.documentWidth <= desktopMarketMetrics.viewport + 2, "Market price intelligence generates desktop horizontal overflow.");
  await desktopPage.screenshot({ path: desktopMarketPricesScreenshot, fullPage: true });
  await desktopPage.goto(`${baseUrl}${adminPath}/inventario`, { waitUntil: "domcontentloaded" });
  await desktopPage.locator(".admin-inventory").waitFor({ state: "visible", timeout: 25_000 });
  await desktopPage.locator(".admin-inventory__skeleton").waitFor({ state: "hidden", timeout: 25_000 });
  const desktopInventoryMetrics = await desktopPage.evaluate(() => ({ viewport: window.innerWidth, documentWidth: document.documentElement.scrollWidth }));
  assert(desktopInventoryMetrics.documentWidth <= desktopInventoryMetrics.viewport + 2, "Inventory forecast generates desktop horizontal overflow.");
  await desktopPage.screenshot({ path: desktopInventoryScreenshot, fullPage: true });
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
      marketPriceIntelligenceResponsive: true,
      marketPriceApprovalLifecycle: true,
      inventoryForecastResponsive: true,
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
        path.relative(process.cwd(), marketPricesScreenshot),
        path.relative(process.cwd(), inventoryScreenshot),
        path.relative(process.cwd(), desktopScreenshot),
        path.relative(process.cwd(), desktopCollapsedScreenshot),
        path.relative(process.cwd(), desktopFinanceScreenshot),
        path.relative(process.cwd(), desktopMarketPricesScreenshot),
        path.relative(process.cwd(), desktopInventoryScreenshot)
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
