import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { getCategories } from "@/lib/db/catalog";
import { toAbsoluteUrl } from "@/lib/seo/site";

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

  return {
    title: category.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: "website",
      title: `${category.name} | Materiales FZAC`,
      description,
      url: canonical,
      images: category.image_url ? [{ url: toAbsoluteUrl(category.image_url), alt: category.name }] : undefined
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
