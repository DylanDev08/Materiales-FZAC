import type { Product } from "../../types/domain.ts";

const XML_INVALID_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

function xmlEscape(value: string) {
  return value
    .replace(XML_INVALID_CHARS, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function validHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function merchantBrand(value?: string | null) {
  const brand = String(value ?? "").trim();
  if (!brand || /^sin marca( informada)?$/i.test(brand) || /^gen[eé]rico$/i.test(brand)) return null;
  return brand;
}

function availability(product: Pick<Product, "availability_status" | "stock">) {
  // Unknown / to-be-confirmed availability is NOT actual inventory.
  return product.availability_status === "IN_STOCK" && product.stock > 0 ? "in_stock" : "out_of_stock";
}

function publicImageUrl(value: string, siteUrl: string): string | null {
  try {
    const url = new URL(value, `${siteUrl}/`);
    return validHttpsUrl(url.href) ? url.href : null;
  } catch {
    return null;
  }
}

export type MerchantFeedIssue = {
  id: string;
  field: "sku" | "slug" | "name" | "price" | "image_link";
};

function productIssues(product: Product, siteUrl: string): MerchantFeedIssue[] {
  const issues: MerchantFeedIssue[] = [];
  const id = String(product.sku ?? "").trim() || String(product.id ?? "unknown");
  if (!String(product.sku ?? "").trim()) issues.push({ id, field: "sku" });
  if (!String(product.slug ?? "").trim()) issues.push({ id, field: "slug" });
  if (!String(product.name ?? "").trim()) issues.push({ id, field: "name" });
  if (!Number.isFinite(product.price) || product.price <= 0) issues.push({ id, field: "price" });
  if (!publicImageUrl(product.image_url, siteUrl)) issues.push({ id, field: "image_link" });
  return issues;
}

export function buildMerchantFeed(products: Product[], siteUrl: string) {
  if (!validHttpsUrl(siteUrl) || new URL(siteUrl).origin !== siteUrl.replace(/\/$/, "")) {
    throw new Error("Merchant feed requires an HTTPS canonical site origin.");
  }

  const items: string[] = [];
  const skipped: MerchantFeedIssue[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const sku = String(product.sku ?? "").trim();
    if (sku && seen.has(sku)) {
      // Duplicated merchant IDs corrupt the data source; do not publish a
      // silently altered set which might overwrite/delist existing products.
      throw new Error("Merchant feed contains duplicate product IDs.");
    }
    if (sku) seen.add(sku);

    const issues = productIssues(product, siteUrl);
    if (issues.length) {
      skipped.push(...issues);
      continue;
    }

    const category = product.category?.name || product.subcategory || "Materiales de construcción";
    const brand = merchantBrand(product.brand);
    const currentPrice = product.price.toFixed(2);
    const comparePrice = Number(product.compare_price);
    const usesSingleItemSalePrice = (
      product.on_sale === true &&
      (product.promotion_type ?? "NONE") === "NONE" &&
      Number.isFinite(comparePrice) &&
      comparePrice > product.price
    );

    const image = publicImageUrl(product.image_url, siteUrl)!;
    const gallery = [...new Set(product.gallery.map((value) => publicImageUrl(value, siteUrl)).filter((value): value is string => Boolean(value)))]
      .filter((value) => value !== image)
      .slice(0, 10);

    const customAvailability = product.availability_status === "CONSULT"
      ? "stock-a-confirmar"
      : availability(product) === "in_stock" ? "stock-disponible" : "sin-stock";

    items.push([
      "<item>",
      `<g:id>${xmlEscape(sku)}</g:id>`,
      `<title>${xmlEscape(product.name)}</title>`,
      `<description>${xmlEscape(product.description || `${product.name} disponible en Materiales FZAC.`)}</description>`,
      `<link>${xmlEscape(`${siteUrl}/producto/${encodeURIComponent(product.slug)}`)}</link>`,
      `<g:image_link>${xmlEscape(image)}</g:image_link>`,
      ...gallery.map((url) => `<g:additional_image_link>${xmlEscape(url)}</g:additional_image_link>`),
      `<g:availability>${availability(product)}</g:availability>`,
      `<g:price>${usesSingleItemSalePrice ? comparePrice.toFixed(2) : currentPrice} ARS</g:price>`,
      ...(usesSingleItemSalePrice ? [`<g:sale_price>${currentPrice} ARS</g:sale_price>`] : []),
      "<g:condition>new</g:condition>",
      ...(brand ? [`<g:brand>${xmlEscape(brand)}</g:brand>`] : []),
      `<g:product_type>${xmlEscape(category)}</g:product_type>`,
      `<g:custom_label_0>${customAvailability}</g:custom_label_0>`,
      `<g:custom_label_1>${xmlEscape(category)}</g:custom_label_1>`,
      "</item>"
    ].join(""));
  }

  if (!items.length) throw new Error("Merchant feed has no valid products; refusing to publish an empty replacement.");

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">',
    "<channel>",
    "<title>Materiales FZAC</title>",
    `<link>${xmlEscape(siteUrl)}</link>`,
    "<description>Catálogo de materiales para construcción de Materiales FZAC</description>",
    ...items,
    "</channel>",
    "</rss>"
  ].join("");

  return { xml, included: items.length, skipped };
}
