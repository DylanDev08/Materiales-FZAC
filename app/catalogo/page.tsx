import { CatalogPage } from "@/components/catalog/catalog-page";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Catálogo de materiales",
  description: "Catálogo online de Materiales FZAC para obra, refacción y mantenimiento.",
  path: "/productos"
});

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Catálogo FZAC" />;
}
