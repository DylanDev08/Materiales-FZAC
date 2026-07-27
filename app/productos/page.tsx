import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/catalog-page";

export const metadata: Metadata = {
  title: "Productos y materiales para obra",
  description:
    "Explorá materiales de construcción, ferretería, pintura, electricidad y plomería con precios y stock visibles.",
  alternates: {
    canonical: "/productos"
  },
  openGraph: {
    title: "Productos y materiales para obra | Materiales FZAC",
    description: "Catálogo de materiales para construcción y mantenimiento en Rosario.",
    url: "/productos"
  }
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Productos" showAdminProductLoader />;
}
