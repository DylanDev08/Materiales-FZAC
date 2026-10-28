// Validate before creating users, orders or provider preferences.
export function assertCheckoutQaTarget(baseUrl, env = process.env) {
  const url = new URL(baseUrl);
  const hostname = url.hostname.replace(/\.$/, "");
  const local = ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("BASE_URL must be an origin without credentials, path, query or fragment.");
  }
  if (!local && url.protocol !== "https:") throw new Error("Remote QA requires HTTPS.");
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("QA requires HTTP or HTTPS.");
  if (hostname === "fzacmateriales.store" || hostname.endsWith(".fzacmateriales.store")) {
    throw new Error("Checkout QA must not target the production storefront.");
  }
  if (!local && env.ALLOW_REMOTE_CHECKOUT_QA !== "true") {
    throw new Error("Remote checkout QA is disabled. Use an isolated staging target.");
  }
  if (env.QA_CONFIRM_MUTATING_CHECKOUT !== "I_UNDERSTAND") {
    throw new Error("QA_CONFIRM_MUTATING_CHECKOUT=I_UNDERSTAND is required, including for local servers backed by remote databases.");
  }
  if (env.PAYMENTS_ENV?.trim().toLowerCase() !== "test" ||
      env.PAYMENTS_PRODUCTION_CONFIRMED?.trim().toLowerCase() === "true") {
    throw new Error("Checkout QA requires explicit test payments and no production confirmation.");
  }
}

export async function assertCheckoutQaRuntime(baseUrl, fetchStatus = fetch) {
  const response = await fetchStatus(`${baseUrl}/api/payments/mercadopago`, {
    redirect: "error",
    signal: AbortSignal.timeout(10_000)
  });
  if (!response.ok) throw new Error("Could not verify the checkout payment environment.");
  const status = await response.json();
  if (status.provider !== "MERCADOPAGO" || status.environment !== "test" || status.enabled !== true) {
    throw new Error("The effective checkout backend must report enabled Mercado Pago test mode before QA mutations.");
  }
  return status;
}
