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

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { slug } = await params;
  const brand = getBrandSeo(slug);
  if (!brand) return { title: "Marca no encontrada", robots: { index: false, follow: false } };

  const canonical = `/marca/${brand.slug}`;
  return {
    title: brand.title,
    description: brand.description,
    alternates: { canonical },
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

  return (
    <>
      <JsonLd data={schema} />
      <CatalogPage
        searchParams={await searchParams}
        title={brand.heading}
        description={brand.intro}
        forcedFilters={{ brand: brand.brand }}
      />
    </>
  );
}
