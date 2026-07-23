import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const isLocal = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl);

if (!isLocal) {
  throw new Error("Authenticated mobile checkout QA only runs against localhost.");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase server configuration is missing.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const email = `qa-mobile-${suffix}@example.com`;
const password = `FzacMobile${crypto.randomBytes(14).toString("hex")}9!`;
const screenshotDirectory = path.join(process.cwd(), "test-results");
const screenshotPath = path.join(screenshotDirectory, "mobile-checkout-authenticated.png");
let userId = null;
let browser = null;
let testError = null;
const cleanupErrors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function normalizeProduct(row) {
  return {
    id: String(row.id),
    slug: String(row.slug),
    sku: String(row.sku),
    name: String(row.name),
    description: String(row.description ?? ""),
    category_id: String(row.category_id ?? ""),
    category: null,
    subcategory: String(row.subcategory ?? "General"),
    brand: String(row.brand ?? "FZAC"),
    price: Number(row.price),
    compare_price: row.compare_price ? Number(row.compare_price) : null,
    stock: Number(row.stock),
    stock_minimum: Number(row.stock_minimum ?? 0),
    unit: String(row.unit ?? "unidad"),
    image_url: String(row.image_url || "/placeholder-product.jpg"),
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    specifications: row.specifications && typeof row.specifications === "object" ? row.specifications : {},
    featured: Boolean(row.featured),
    on_sale: Boolean(row.on_sale),
    active: Boolean(row.active)
  };
}

async function cleanup() {
  if (browser) await browser.close().catch(() => cleanupErrors.push("Could not close the QA browser."));
  if (!userId) return;

  const { error: profileError } = await admin.from("profiles").delete().eq("id", userId);
  const { error: userError } = await admin.auth.admin.deleteUser(userId);
  if (profileError || userError) cleanupErrors.push("Could not remove the isolated mobile QA user.");
}

try {
  const { data: products, error: productError } = await admin
    .from("products")
    .select("*")
    .eq("active", true)
    .gt("stock", 0)
    .gt("price", 0)
    .order("price", { ascending: true })
    .limit(1);
  if (productError || !products?.[0]) throw new Error("No active product is available for mobile checkout QA.");
  const product = normalizeProduct(products[0]);

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "FZAC Mobile QA" }
  });
  if (createError || !created.user) throw new Error("Could not create the isolated mobile QA user.");
  userId = created.user.id;

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/login?next=/checkout`, { waitUntil: "domcontentloaded" });
  await page.getByLabel(/^email$/i).fill(email);
  await page.locator("input[type='password']").fill(password);
  await page.getByRole("button", { name: /^ingresar$/i }).click();
  await page.waitForURL((url) => url.pathname === "/checkout", { timeout: 20_000 });

  await page.evaluate((cartProduct) => {
    window.localStorage.setItem(
      "fzac-cart-v1",
      JSON.stringify([{ productId: cartProduct.id, quantity: 1, product: cartProduct }])
    );
  }, product);
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("input[autocomplete='name']").fill("FZAC Mobile QA");
  await page.locator("input[autocomplete='email']").fill(email);
  await page.locator("input[autocomplete='tel']").fill("+5493410000000");
  await page.getByRole("button", { name: /^continuar$/i }).click();

  await page.getByRole("button", { name: /retiro coordinado/i }).click();
  await page.getByRole("button", { name: /^continuar$/i }).click();
  await page.getByText(/productos disponibles/i).waitFor({ state: "visible", timeout: 20_000 });
  await page.getByRole("button", { name: /continuar al pago/i }).click();

  const paymentLabels = [
    "Mercado Pago",
    "Transferencia FZAC",
    "WhatsApp"
  ];
  const paymentBoxes = [];
  for (const label of paymentLabels) {
    const option = page.locator(".payment-mode-button").filter({ hasText: label });
    await option.waitFor({ state: "visible" });
    paymentBoxes.push(await option.boundingBox());
  }

  assert(paymentBoxes.every(Boolean), "Every payment method must be visible.");
  assert(
    paymentBoxes.every((box) => box.width >= 290 && box.height >= 64),
    "Payment methods must remain full-width touch targets on mobile."
  );
  assert(
    paymentBoxes.every((box, index) => index === 0 || box.y >= paymentBoxes[index - 1].y + paymentBoxes[index - 1].height),
    "Payment methods overlap on mobile."
  );

  const summaryToggle = page.getByRole("button", { name: /tu pedido/i });
  await summaryToggle.click();
  await page.locator(".checkout-summary-details").waitFor({ state: "visible" });

  const metrics = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    inputFontSizes: [...document.querySelectorAll("input")].map((element) =>
      Number.parseFloat(window.getComputedStyle(element).fontSize)
    )
  }));
  assert(metrics.documentWidth <= metrics.viewport + 2, "Checkout generates horizontal overflow.");
  assert(metrics.inputFontSizes.every((size) => size >= 16), "Checkout inputs can trigger unwanted iOS zoom.");

  await fs.mkdir(screenshotDirectory, { recursive: true });
  await page.screenshot({ path: screenshotPath, fullPage: true });

  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      authenticated: true,
      checkoutSteps: true,
      paymentMethods: paymentLabels.length,
      paymentMethodsStacked: true,
      summaryCollapsible: true,
      horizontalOverflow: false,
      iOSInputZoomProtected: true,
      screenshot: path.relative(process.cwd(), screenshotPath)
    })}\n`
  );
} catch (error) {
  testError = error;
} finally {
  await cleanup();
}

if (cleanupErrors.length) {
  throw new Error(cleanupErrors.join(" "));
}
if (testError) throw testError;
