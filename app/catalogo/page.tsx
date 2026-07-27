import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/catalog-page";

export const metadata: Metadata = {
  title: "Catálogo de materiales",
  description: "Catálogo online de Materiales FZAC para obra, refacción y mantenimiento.",
  alternates: {
    canonical: "/productos"
  }
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Catálogo FZAC" />;
}
