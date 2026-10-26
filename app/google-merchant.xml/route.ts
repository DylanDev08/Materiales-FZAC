import { getMerchantFeedProducts } from "@/lib/db/catalog";
import { buildMerchantFeed } from "@/lib/merchant/feed";
import { getPublicSiteUrl } from "@/lib/seo/site";

// Keep the same public URL and IDs previously linked in Google Merchant Center.
export const revalidate = 600;

export async function GET() {
  try {
    const siteUrl = getPublicSiteUrl();
    const products = await getMerchantFeedProducts();
    const result = buildMerchantFeed(products, siteUrl);

    if (result.skipped.length) {
      console.warn("[merchant-feed] products skipped due to missing/invalid required data", {
        count: result.skipped.length,
        fields: [...new Set(result.skipped.map((issue) => issue.field))]
      });
    }

    return new Response(result.xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=60",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch {
    // Do not return an empty/synthetic XML feed on database errors: Google may
    // interpret it as a request to remove all current products.
    console.error("[merchant-feed] generation failed; preserving existing source until next refresh");
    return new Response("Catálogo temporalmente no disponible.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
}
