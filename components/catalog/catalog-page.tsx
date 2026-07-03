import { BadgePercent, Search, ShieldCheck, Truck } from "lucide-react";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductGrid } from "@/components/catalog/product-grid";
import { getCategories, getProducts } from "@/lib/db/catalog";
import type { ProductFilters } from "@/lib/db/catalog";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

export async function CatalogPage({
  searchParams,
  title = "Catalogo FZAC",
  forcedFilters = {}
}: {
  searchParams: SearchParams;
  title?: string;
  forcedFilters?: ProductFilters;
}) {
  const filters: ProductFilters = {
    search: value(searchParams, "search"),
    category: value(searchParams, "category"),
    brand: value(searchParams, "brand"),
    minPrice: value(searchParams, "minPrice") ? Number(value(searchParams, "minPrice")) : undefined,
    maxPrice: value(searchParams, "maxPrice") ? Number(value(searchParams, "maxPrice")) : undefined,
    inStock: value(searchParams, "inStock") === "true",
    onSale: value(searchParams, "onSale") === "true",
    order: value(searchParams, "order") as ProductFilters["order"],
    ...forcedFilters
  };

  const [categories, products] = await Promise.all([getCategories(), getProducts(filters)]);
  const filterValues = {
    search: value(searchParams, "search"),
    category: forcedFilters.category ?? value(searchParams, "category"),
    brand: value(searchParams, "brand"),
    minPrice: value(searchParams, "minPrice"),
    maxPrice: value(searchParams, "maxPrice"),
    order: value(searchParams, "order"),
    inStock: value(searchParams, "inStock"),
    onSale: forcedFilters.onSale ? "true" : value(searchParams, "onSale")
  };

  return (
    <main>
      <section className="catalog-filter-band">
        <div className="container">
          <CatalogFilters categories={categories} values={filterValues} />
        </div>
      </section>

      <section className="catalog-hero">
        <div className="container catalog-hero__inner">
          <div>
            <span className="kicker">Tienda online</span>
            <h1>{title}</h1>
            <p>Busca, filtra y compra materiales con stock y precios validados al iniciar el checkout.</p>
          </div>
          <div className="catalog-hero__chips" aria-label="Ventajas del catalogo">
            <span>
              <Search size={17} /> Busqueda instantanea
            </span>
            <span>
              <BadgePercent size={17} /> Ofertas visibles
            </span>
            <span>
              <Truck size={17} /> Envio o retiro
            </span>
            <span>
              <ShieldCheck size={17} /> Pago seguro
            </span>
          </div>
        </div>
      </section>

      <section className="page-section">
        <div className="container">
          <section className="catalog-content">
            <div className="catalog-toolbar">
              <p>{products.length} productos visibles</p>
              <span className="status-pill">Vista grid</span>
            </div>
            <ProductGrid products={products} />
          </section>
        </div>
      </section>
    </main>
  );
}
