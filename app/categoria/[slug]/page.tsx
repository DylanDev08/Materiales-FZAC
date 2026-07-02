import { notFound } from "next/navigation";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { getCategories } from "@/lib/db/catalog";

export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.find((item) => item.slug === slug);
  if (!category) notFound();

  return <CatalogPage searchParams={searchParams} title={category.name} forcedFilters={{ category: category.slug }} />;
}
