import { CatalogPage } from "@/components/catalog/catalog-page";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Productos y materiales para obra",
  description:
    "Explorá materiales de construcción, ferretería, pintura, electricidad y plomería con precios y stock visibles.",
  path: "/productos"
});

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Productos" showAdminProductLoader />;
}
