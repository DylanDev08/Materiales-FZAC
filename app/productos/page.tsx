import { CatalogPage } from "@/components/catalog/catalog-page";
import { publicPageMetadata } from "@/lib/seo/metadata";

export const metadata = publicPageMetadata({
  title: "Construcción en seco, Steel Framing y Ferretería",
  description:
    "Explorá construcción en seco, steel framing, ferretería y materiales de obra con precios FZAC y disponibilidad informada.",
  path: "/productos"
});

export default async function Page({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CatalogPage searchParams={await searchParams} title="Productos" showAdminProductLoader />;
}
