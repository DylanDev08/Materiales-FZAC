import { CatalogPage } from "@/components/catalog/catalog-page";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Ofertas en materiales",
  description: "Ofertas vigentes de Materiales FZAC sujetas a stock y validación al confirmar la compra.",
  path: "/ofertas"
});

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Ofertas" forcedFilters={{ onSale: true }} />;
}
