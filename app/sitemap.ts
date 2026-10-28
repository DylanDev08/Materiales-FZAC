import type { MetadataRoute } from "next";
import { getMerchantFeedProducts } from "@/lib/db/catalog";
import { getPublicSiteUrl, isSeoIndexingEnabled } from "@/lib/seo/site";
import { BRAND_SEO } from "@/lib/seo/brand-content";

// Build at request time using the real catalog only. A database outage must
// never generate a fake sitemap from local demo products.
export const dynamic = "force-dynamic";

const publicRoutes = [
  "",
  "/productos",
  "/categorias",
  "/marcas",
  "/ofertas",
  "/como-comprar",
  "/guias",
  "/guias/materiales-pared-durlock",
  "/guias/placa-durlock-estandar-verde-roja",
  "/guias/membrana-liquida-para-techo",
  "/guias/materiales-steel-framing",
  "/calculadoras",
  "/calculadoras/placas-durlock",
  "/calculadoras/pintura",
  "/calculadoras/membrana-liquida",
  "/contacto",
  "/envios-y-retiros",
  "/medios-de-pago",
  "/terminos",
  "/privacidad",
  "/cambios-y-devoluciones",
  "/arrepentimiento"
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isSeoIndexingEnabled()) return [];

  const siteUrl = getPublicSiteUrl();
  const products = await getMerchantFeedProducts();
  const categories = new Map(
    products
      .filter((product) => product.category?.slug)
      .map((product) => [product.category!.slug, product.category!])
  );

  return [
    ...publicRoutes.map((path, index) => ({
      url: `${siteUrl}${path || "/"}`,
      changeFrequency: index === 0 ? ("daily" as const) : ("weekly" as const),
      priority: index === 0 ? 1 : path === "/productos" ? 0.9 : 0.7
    })),
    ...Array.from(categories.values()).map((category) => ({
      url: `${siteUrl}/categoria/${encodeURIComponent(category.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...BRAND_SEO.map((brand) => ({
      url: `${siteUrl}/marca/${brand.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.75
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/producto/${encodeURIComponent(product.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
