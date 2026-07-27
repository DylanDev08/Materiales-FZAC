import type { MetadataRoute } from "next";
import { getPublicSiteUrl, isSeoIndexingEnabled } from "@/lib/seo/site";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();

  if (!isSeoIndexingEnabled()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/"
      }
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin/",
        "/cuenta/",
        "/checkout/",
        "/carrito/",
        "/login",
        "/registro",
        "/recuperar",
        "/restablecer"
      ]
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl
  };
}
