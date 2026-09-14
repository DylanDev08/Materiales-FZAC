import type { MetadataRoute } from "next";
import { getCategories, getProducts } from "@/lib/db/catalog";
import { getPublicSiteUrl, isSeoIndexingEnabled } from "@/lib/seo/site";

export const revalidate = 3600;

const publicRoutes = [
  "",
  "/productos",
  "/categorias",
  "/ofertas",
  "/como-comprar",
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
  const categories = await getCategories();
  const products = [];
  const pageSize = 250;
  for (let offset = 0; ; offset += pageSize) {
    const page = await getProducts({ limit: pageSize, offset, order: "name_asc" });
    products.push(...page);
    if (page.length < pageSize) break;
  }

  return [
    ...publicRoutes.map((path, index) => ({
      url: `${siteUrl}${path || "/"}`,
      changeFrequency: index === 0 ? ("daily" as const) : ("weekly" as const),
      priority: index === 0 ? 1 : path === "/productos" ? 0.9 : 0.7
    })),
    ...categories.map((category) => ({
      url: `${siteUrl}/categoria/${encodeURIComponent(category.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    })),
    ...products.map((product) => ({
      url: `${siteUrl}/producto/${encodeURIComponent(product.slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8
    }))
  ];
}
