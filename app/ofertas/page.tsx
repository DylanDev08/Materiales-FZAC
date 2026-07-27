import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/catalog-page";

export const metadata: Metadata = {
  title: "Ofertas en materiales",
  description: "Ofertas vigentes de Materiales FZAC sujetas a stock y validación al confirmar la compra.",
  alternates: {
    canonical: "/ofertas"
  }
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Ofertas" forcedFilters={{ onSale: true }} />;
}
