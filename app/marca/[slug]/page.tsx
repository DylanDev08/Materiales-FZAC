import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { JsonLd } from "@/components/seo/json-ld";
import { getProducts } from "@/lib/db/catalog";
import { BRAND_SEO, getBrandSeo } from "@/lib/seo/brand-content";
import { getPublicSiteUrl, SITE_NAME } from "@/lib/seo/site";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export function generateStaticParams() {
  return BRAND_SEO.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const brand = getBrandSeo(slug);
  if (!brand) return { title: "Marca no encontrada", robots: { index: false, follow: false } };

  const canonical = `/marca/${brand.slug}`;
  const hasFilters = Object.entries(resolvedSearchParams).some(([key, raw]) => {
    if (key === "view") return false;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(String(value ?? "").trim());
  });

  return {
    title: brand.title,
    description: brand.description,
    alternates: { canonical },
    ...(hasFilters ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${brand.title} | ${SITE_NAME}`,
      description: brand.description,
      url: canonical
    }
  };
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params;
  const brand = getBrandSeo(slug);
  if (!brand) notFound();

  const products = await getProducts({ brand: brand.brand, limit: 250, order: "name_asc" });

  const siteUrl = getPublicSiteUrl();
  const brandUrl = `${siteUrl}/marca/${brand.slug}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${brandUrl}#collection`,
    name: brand.heading,
    description: brand.description,
    url: brandUrl,
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: { "@type": "Brand", name: brand.brand },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: products.length,
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: product.name,
        url: `${siteUrl}/producto/${encodeURIComponent(product.slug)}`
      }))
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Marcas", item: `${siteUrl}/marcas` },
      { "@type": "ListItem", position: 3, name: brand.brand, item: brandUrl }
    ]
  };

  return (
    <>
      <JsonLd data={[schema, breadcrumbSchema]} />
      <CatalogPage
        searchParams={await searchParams}
        title={brand.heading}
        description={brand.intro}
        forcedFilters={{ brand: brand.brand }}
      />
    </>
  );
}
