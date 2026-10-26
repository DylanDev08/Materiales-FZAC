import { getProducts } from "@/lib/db/catalog";
import { getPublicSiteUrl, toAbsoluteUrl } from "@/lib/seo/site";

export const revalidate = 3600;

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function merchantAvailability(status?: string | null, stock?: number) {
  if (status === "IN_STOCK" && Number(stock ?? 0) > 0) return "in_stock";
  return "out_of_stock";
}

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  const products = [];
  const pageSize = 250;

  for (let offset = 0; ; offset += pageSize) {
    const page = await getProducts({ limit: pageSize, offset, order: "name_asc" });
    products.push(...page);
    if (page.length < pageSize) break;
  }

  const items = products.map((product) => {
    const category = product.category?.name || product.subcategory || "Materiales de construcción";
    const availability = merchantAvailability(product.availability_status, product.stock);
    const customAvailability =
      product.availability_status === "CONSULT"
        ? "stock-a-confirmar"
        : product.availability_status === "OUT_OF_STOCK"
          ? "sin-stock"
          : "stock-disponible";

    return [
      "<item>",
      `<g:id>${xmlEscape(product.sku)}</g:id>`,
      `<title>${xmlEscape(product.name)}</title>`,
      `<description>${xmlEscape(product.description || `${product.name} disponible en Materiales FZAC.`)}</description>`,
      `<link>${xmlEscape(`${siteUrl}/producto/${encodeURIComponent(product.slug)}`)}</link>`,
      `<g:image_link>${xmlEscape(toAbsoluteUrl(product.image_url))}</g:image_link>`,
      `<g:availability>${availability}</g:availability>`,
      `<g:price>${product.price.toFixed(2)} ARS</g:price>`,
      "<g:condition>new</g:condition>",
      `<g:brand>${xmlEscape(product.brand || "FZAC")}</g:brand>`,
      `<g:product_type>${xmlEscape(category)}</g:product_type>`,
      `<g:custom_label_0>${customAvailability}</g:custom_label_0>`,
      `<g:custom_label_1>${xmlEscape(category)}</g:custom_label_1>`,
      "</item>"
    ].join("");
  });

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

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"
    }
  });
}
