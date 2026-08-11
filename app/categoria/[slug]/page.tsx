import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { getCategories } from "@/lib/db/catalog";
import { SITE_NAME, SOCIAL_IMAGE, toAbsoluteUrl } from "@/lib/seo/site";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<CategoryPageProps, "params">): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);

  if (!category) {
    return {
      title: "Categoría no encontrada",
      robots: { index: false, follow: false }
    };
  }

  const canonical = `/categoria/${category.slug}`;
  const description =
    category.description || `Productos de ${category.name} disponibles en el catálogo online de Materiales FZAC.`;
  const socialImage = toAbsoluteUrl(category.image_url || SOCIAL_IMAGE);

  return {
    title: category.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      locale: "es_AR",
      siteName: SITE_NAME,
      title: `${category.name} | Materiales FZAC`,
      description,
      url: canonical,
      images: [{ url: socialImage, alt: category.name }]
    },
    twitter: {
      card: "summary_large_image",
      title: `${category.name} | ${SITE_NAME}`,
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

  return (
    <CatalogPage
      searchParams={resolvedSearchParams}
      title={category.name}
      description={category.description}
      forcedFilters={{ category: category.slug }}
    />
  );
}
