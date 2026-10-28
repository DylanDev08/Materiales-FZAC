import { CatalogPage } from "@/components/catalog/catalog-page";
import { publicPageMetadata } from "@/lib/seo/metadata";

type SearchParams = Record<string, string | string[] | undefined>;

export const metadata = publicPageMetadata({
  title: "Materiales de construcción en Rosario: precios y catálogo",
  description:
    "Explorá materiales de construcción en Rosario: Durlock, Steel Framing, ferretería, pintura e impermeabilización. Compará precios, consultá stock y coordiná retiro o envío.",
  path: "/productos"
});

export default async function Page({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <CatalogPage
      searchParams={await searchParams}
      title="Materiales de construcción en Rosario"
      description="Catálogo FZAC con precios, SKU y disponibilidad para construcción en seco, Steel Framing, ferretería, pintura, impermeabilización y materiales de obra."
    />
  );
}
