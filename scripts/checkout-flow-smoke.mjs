import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const isLocal = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(baseUrl);
const remoteQaEnabled =
  process.env.ALLOW_REMOTE_CHECKOUT_QA === "true" &&
  process.env.QA_CONFIRM_MUTATING_CHECKOUT === "I_UNDERSTAND";

if (!isLocal && !remoteQaEnabled) {
  throw new Error(
    "Remote checkout QA is disabled. Set ALLOW_REMOTE_CHECKOUT_QA=true and QA_CONFIRM_MUTATING_CHECKOUT=I_UNDERSTAND explicitly."
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env["\uFEFFNEXT_PUBLIC_SUPABASE_URL"];
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});
const suffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
const email = `qa-checkout-${suffix}@example.com`;
const password = `FzacCheckout${crypto.randomBytes(16).toString("hex")}9`;
const orderIds = new Set();
const preferenceIds = new Set();
let userId = null;

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function createCheckout(cookies, productId, method, idempotencyKey) {
  const response = await fetch(`${baseUrl}/api/checkout/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookies,
      Origin: baseUrl
    },
    body: JSON.stringify({
      customer_name: "FZAC Checkout QA",
      customer_email: email,
      customer_phone: "+5493410000000",
      shipping_method: "PICKUP",
      address_snapshot: {},
      notes: "QA automatizado FZAC no preparar mercaderia",
      payment_method: method,
      payment_flow:
        method === "MERCADOPAGO" ? "CHECKOUT_PRO" : method === "BANK_TRANSFER" ? "TRANSFER" : "WHATSAPP",
      idempotency_key: idempotencyKey,
      items: [{ product_id: productId, quantity: 1 }]
    })
  });
  const body = await readJson(response);
  if (body.order_id) orderIds.add(String(body.order_id));
  if (body.preference_id) preferenceIds.add(String(body.preference_id));
  if (!response.ok) {
    throw new Error(`Checkout ${method} failed with HTTP ${response.status}: ${String(body.code || body.error || "UNKNOWN")}`);
  }
  assert(response.status === 201, `Checkout ${method} must return HTTP 201.`);
  return body;
}

async function deactivatePreferences(cleanupErrors) {
  if (!mercadoPagoAccessToken) return;
  for (const preferenceId of preferenceIds) {
    try {
      const response = await fetch(`https://api.mercadopago.com/checkout/preferences/${encodeURIComponent(preferenceId)}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${mercadoPagoAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ active: false })
      });
      if (!response.ok) cleanupErrors.push(`Could not deactivate QA preference (${response.status}).`);
    } catch {
      cleanupErrors.push("Could not deactivate a QA preference.");
    }
  }
}

async function cleanupQaData() {
  const cleanupErrors = [];
  const { data: discoveredOrders, error: discoveryError } = await admin
    .from("orders")
    .select("id")
    .eq("customer_email", email);
  if (discoveryError) cleanupErrors.push("Could not discover all isolated QA orders.");
  for (const order of discoveredOrders ?? []) orderIds.add(String(order.id));
  const ids = [...orderIds];

  await deactivatePreferences(cleanupErrors);

  if (ids.length) {
    const [{ data: orders, error: ordersError }, { data: payments, error: paymentsError }, { data: tickets, error: ticketsError }] =
      await Promise.all([
        admin.from("orders").select("id,user_id,customer_email,status,paid_at").in("id", ids),
        admin.from("payments").select("order_id,status").in("order_id", ids),
        admin.from("purchase_tickets").select("order_id").in("order_id", ids)
      ]);

    if (ordersError || paymentsError || ticketsError) {
      cleanupErrors.push("Could not verify QA records before cleanup.");
    } else {
      const expectedOrders = orders?.length === ids.length;
      const safeOrders = (orders ?? []).every(
        (order) =>
          order.user_id === userId &&
          String(order.customer_email).toLowerCase() === email &&
          ["PENDING_PAYMENT", "PENDING_TRANSFER", "PENDING_ADMIN_APPROVAL", "COORDINATE"].includes(String(order.status)) &&
          !order.paid_at
      );
      const safePayments = (payments ?? []).every((payment) => payment.status === "PENDING");
      const noTickets = (tickets ?? []).length === 0;

      if (!expectedOrders || !safeOrders || !safePayments || !noTickets) {
        cleanupErrors.push("QA records changed to a non-pending state; automatic deletion was stopped.");
      } else {
        for (const orderId of ids) {
          const { error } = await admin.from("notifications").delete().like("link_to", `%${orderId}%`);
          if (error) cleanupErrors.push("Could not remove a QA admin notification.");
        }
        const { error: orderDeleteError } = await admin.from("orders").delete().in("id", ids);
        if (orderDeleteError) cleanupErrors.push("Could not remove isolated QA orders.");
      }
    }
  }

  if (!cleanupErrors.length && userId) {
    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", userId);
    const { error: userDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (profileDeleteError || userDeleteError) cleanupErrors.push("Could not remove the isolated QA user.");
  }

  if (cleanupErrors.length) throw new Error(cleanupErrors.join(" "));
}

let result;
let testError;

try {
  const { data: products, error: productError } = await admin
    .from("products")
    .select("id,name,price,stock")
    .eq("active", true)
    .gt("stock", 0)
    .gt("price", 0)
    .lte("price", Number(process.env.QA_MAX_PRODUCT_PRICE || 100000))
    .order("price", { ascending: true })
    .limit(1);
  if (productError || !products?.[0]) throw new Error("No safe active product is available for checkout QA.");
  const product = products[0];

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "FZAC Checkout QA" }
  });
  if (createError || !created.user) throw new Error("Could not create the isolated checkout QA user.");
  userId = created.user.id;

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: baseUrl },
    body: JSON.stringify({ email, password }),
    redirect: "manual"
  });
  const loginBody = await readJson(login);
  assert(login.ok && loginBody.target === "/cuenta", `QA login failed with HTTP ${login.status}.`);
  const cookies = cookieHeader(login);
  assert(Boolean(cookies), "QA login did not issue a session cookie.");

  if (process.env.QA_EXPECT_CARD_ENABLED !== "true") {
    const checkoutPage = await fetch(`${baseUrl}/checkout`, { headers: { Cookie: cookies } });
    const checkoutHtml = await checkoutPage.text();
    assert(checkoutPage.ok, `Authenticated checkout page failed with HTTP ${checkoutPage.status}.`);
    assert(!checkoutHtml.includes("Tarjeta online segura"), "Disabled card payments are still visible in checkout.");
  }

  const transferKey = `fzac-qa-transfer-${crypto.randomUUID()}`;
  const transfer = await createCheckout(cookies, product.id, "BANK_TRANSFER", transferKey);
  const transferReplay = await createCheckout(cookies, product.id, "BANK_TRANSFER", transferKey);
  assert(transfer.order_id === transferReplay.order_id, "Transfer idempotency created a second order.");
  assert(transfer.payment_id === transferReplay.payment_id, "Transfer idempotency created a second payment.");
  assert(transfer.redirect_url === null, "Bank transfer returned a Mercado Pago redirect.");
  assert(transfer.order_status === "PENDING_TRANSFER", "Bank transfer did not remain pending.");

  const whatsapp = await createCheckout(cookies, product.id, "WHATSAPP", `fzac-qa-whatsapp-${crypto.randomUUID()}`);
  assert(whatsapp.redirect_url === null, "WhatsApp returned a Mercado Pago redirect.");
  assert(/^https:\/\/wa\.me\//.test(String(whatsapp.whatsapp_url)), "WhatsApp checkout did not return a valid URL.");
  assert(whatsapp.order_status === "COORDINATE", "WhatsApp checkout did not remain coordinated.");

  const mercadoPago = await createCheckout(
    cookies,
    product.id,
    "MERCADOPAGO",
    `fzac-qa-mercadopago-${crypto.randomUUID()}`
  );
  assert(mercadoPago.order_status === "PENDING_PAYMENT", "Mercado Pago order did not remain pending.");
  assert(Boolean(mercadoPago.sandbox_init_point), "Mercado Pago test checkout did not return sandbox_init_point.");
  assert(/mercadopago/i.test(String(mercadoPago.redirect_url)), "Mercado Pago checkout did not return a provider redirect.");

  let cardGuard = null;
  if (process.env.QA_EXPECT_CARD_ENABLED !== "true") {
    const cardResponse = await fetch(`${baseUrl}/api/checkout/card`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
        Origin: baseUrl
      },
      body: JSON.stringify({
        customer_name: "FZAC Checkout QA",
        customer_email: email,
        customer_phone: "+5493410000000",
        shipping_method: "PICKUP",
        address_snapshot: {},
        notes: "QA automatizado FZAC no preparar mercaderia",
        payment_method: "MERCADOPAGO",
        payment_flow: "CARD",
        idempotency_key: `fzac-qa-card-disabled-${crypto.randomUUID()}`,
        items: [{ product_id: product.id, quantity: 1 }],
        card: {
          token: "disabled-card-token",
          payment_method_id: "master",
          installments: 1,
          identification_type: "DNI",
          identification_number: "12345678",
          cardholder_email: "test@testuser.com"
        }
      })
    });
    const cardBody = await readJson(cardResponse);
    assert(cardResponse.status === 503, `Disabled card endpoint returned HTTP ${cardResponse.status}.`);
    assert(cardBody.error === "PAYMENT_PROVIDER_NOT_CONFIGURED", "Disabled card endpoint returned an unexpected error.");
    const { count: qaOrderCount, error: qaOrderCountError } = await admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_email", email);
    assert(!qaOrderCountError && qaOrderCount === orderIds.size, "Disabled card request created an order.");
    cardGuard = { hidden: true, status: 503, wroteOrder: false };
  }

  result = {
    ok: true,
    baseUrl,
    login: login.status,
    productChecked: true,
    idempotency: true,
    bankTransfer: { status: 201, redirect: false, pending: true },
    whatsapp: { status: 201, redirect: false, pending: true, url: true },
    mercadoPago: { status: 201, sandbox: true, pending: true },
    cardGuard,
    createdOrders: orderIds.size
  };
} catch (error) {
  testError = error;
} finally {
  try {
    await cleanupQaData();
  } catch (cleanupError) {
    if (testError) {
      throw new AggregateError([testError, cleanupError], "Checkout QA and cleanup both failed.");
    }
    throw cleanupError;
  }
}

if (testError) throw testError;
console.log(JSON.stringify({ ...result, cleanup: true }));
