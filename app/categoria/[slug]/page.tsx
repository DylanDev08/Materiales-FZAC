import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { JsonLd } from "@/components/seo/json-ld";
import { getCategories, getProducts } from "@/lib/db/catalog";
import { getCategorySeoContent } from "@/lib/seo/category-content";
import { getPublicSiteUrl, SITE_NAME, SOCIAL_IMAGE, toAbsoluteUrl } from "@/lib/seo/site";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params, searchParams }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    return {
      title: "Categoría no encontrada",
      robots: { index: false, follow: false }
    };
  }

  const canonical = `/categoria/${category.slug}`;
  const seo = getCategorySeoContent(category.slug, category.name, category.description);
  const description = seo.description;
  const socialImage = toAbsoluteUrl(category.image_url || SOCIAL_IMAGE);

  const hasFilters = Object.entries(resolvedSearchParams).some(([key, raw]) => {
    if (key === "view") return false;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(String(value ?? "").trim());
  });

  return {
    title: seo.title,
    description,
    alternates: { canonical },
    ...(hasFilters ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${seo.title} | Materiales FZAC`,
      description,
      url: canonical,
      images: [{ url: socialImage, alt: category.name }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${seo.title} | ${SITE_NAME}`,
      description,
      images: [socialImage]
    }
  };
}

export default async function Page({
  params,
  searchParams
}: CategoryPageProps) {
  const { slug } = await params;
  const resolvedSearchParams = await searchParams;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  const seo = getCategorySeoContent(category.slug, category.name, category.description);
  const products = await getProducts({ category: category.slug, limit: 24, order: "name_asc" });
  const siteUrl = getPublicSiteUrl();
  const categoryUrl = `${siteUrl}/categoria/${encodeURIComponent(category.slug)}`;

  const categorySchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${categoryUrl}#collection`,
    name: seo.heading,
    description: seo.description,
    url: categoryUrl,
    isPartOf: { "@id": `${siteUrl}/#website` },
    about: {
      "@type": "Thing",
      name: category.name
    },
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.map((product, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${siteUrl}/producto/${encodeURIComponent(product.slug)}`,
        name: product.name
      }))
    }
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Productos", item: `${siteUrl}/productos` },
      { "@type": "ListItem", position: 2, name: category.name, item: categoryUrl }
    ]
  };

  return (
    <>
      <JsonLd data={[categorySchema, breadcrumbSchema]} />
      <CatalogPage
        searchParams={resolvedSearchParams}
        title={seo.heading}
        description={seo.description}
        forcedFilters={{ category: category.slug }}
        seoContent={seo}
      />
    </>
  );
}
