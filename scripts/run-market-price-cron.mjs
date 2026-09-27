const url = process.env.CRON_TARGET_URL;
const secret = process.env.MARKET_PRICE_CRON_SECRET;
if (!url || !secret) throw new Error("Cron de precios sin configurar.");

const response = await fetch(url, {
  method: "GET",
  headers: { Authorization: `Bearer ${secret}`, "User-Agent": "FZAC-Daily-Price-Cron/1.0" }
});
const body = await response.text();
if (!response.ok) throw new Error(`Cron HTTP ${response.status}: ${body.slice(0, 500)}`);
console.log(body);
