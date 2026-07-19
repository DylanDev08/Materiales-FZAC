import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { getCategories } from "@/lib/db/catalog";

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
