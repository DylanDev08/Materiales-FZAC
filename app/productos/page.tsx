import type { Metadata } from "next";
import { CatalogPage } from "@/components/catalog/catalog-page";
import { publicPageMetadata } from "@/lib/seo/metadata";

type SearchParams = Record<string, string | string[] | undefined>;

const baseMetadata = publicPageMetadata({
  title: "Materiales de construcción en Rosario: precios y catálogo",
  description:
    "Explorá materiales de construcción en Rosario: Durlock, Steel Framing, ferretería, pintura, impermeabilización y materiales de obra con precios, SKU y pedido por WhatsApp.",
  path: "/productos"
});

export async function generateMetadata({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const params = await searchParams;
  const hasFilters = Object.entries(params).some(([key, raw]) => {
    if (key === "view") return false;
    const value = Array.isArray(raw) ? raw[0] : raw;
    return Boolean(String(value ?? "").trim());
  });

  return {
    ...baseMetadata,
    ...(hasFilters
      ? {
          robots: {
            index: false,
            follow: true
          }
        }
      : {})
  };
}

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
