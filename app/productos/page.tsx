import { CatalogPage } from "@/components/catalog/catalog-page";

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  return <CatalogPage searchParams={searchParams} title="Productos" />;
}
