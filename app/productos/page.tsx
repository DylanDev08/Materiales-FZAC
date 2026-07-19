import { CatalogPage } from "@/components/catalog/catalog-page";

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Productos" />;
}
