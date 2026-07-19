import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Boxes, ChevronRight, PackageSearch } from "lucide-react";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductGrid } from "@/components/catalog/product-grid";
import { CatalogFiltersSkeleton, CatalogViewToggleSkeleton } from "@/components/catalog/product-grid-skeleton";
import { CatalogViewToggle } from "@/components/catalog/catalog-view-toggle";
import { getCatalogFacets, getCategories, getProducts } from "@/lib/db/catalog";
import type { ProductFilters } from "@/lib/db/catalog";

type SearchParams = Record<string, string | string[] | undefined>;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

export async function CatalogPage({
  searchParams,
  title = "Catálogo FZAC",
  description,
  forcedFilters = {}
}: {
  searchParams: SearchParams;
  title?: string;
  description?: string;
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
    featured: value(searchParams, "featured") === "true",
    order: value(searchParams, "order") as ProductFilters["order"],
    ...forcedFilters
  };

  const [categories, products, facets] = await Promise.all([getCategories(), getProducts(filters), getCatalogFacets()]);
  const filterValues = {
    search: value(searchParams, "search"),
    category: forcedFilters.category ?? value(searchParams, "category"),
    brand: value(searchParams, "brand"),
    minPrice: value(searchParams, "minPrice"),
    maxPrice: value(searchParams, "maxPrice"),
    order: value(searchParams, "order"),
    inStock: value(searchParams, "inStock"),
    onSale: forcedFilters.onSale ? "true" : value(searchParams, "onSale"),
    featured: forcedFilters.featured ? "true" : value(searchParams, "featured")
  };
  const view = value(searchParams, "view") === "list" ? "list" : "grid";
  const lockedCategory = forcedFilters.category;
  const lead =
    description ||
    (lockedCategory
      ? "Explorá productos del rubro, compará disponibilidad y filtrá sin salir de la categoría."
      : "Encontrá materiales por rubro, marca, precio y disponibilidad real.");

  return (
    <main className="catalog-page">
      <section className="catalog-masthead">
        <div className="container catalog-masthead__inner">
          <div>
            <span className="kicker">Tienda FZAC</span>
            <h1>{title}</h1>
            <p>{lead}</p>
          </div>
          <Link className="catalog-masthead__categories" href="/categorias">
            <Boxes size={22} />
            <span>
              <small>Explorar por proyecto</small>
              <strong>Ver todos los rubros</strong>
            </span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      <section className="catalog-controls-shell">
        <div className="container">
          <nav className="catalog-category-rail" aria-label="Rubros de productos">
            <Link href="/productos" className={!lockedCategory ? "is-active" : ""}>
              Todos
            </Link>
            {categories.map((category) => (
              <Link
                href={`/categoria/${category.slug}`}
                className={lockedCategory === category.slug ? "is-active" : ""}
                key={category.id}
              >
                {category.name}
              </Link>
            ))}
          </nav>
          <Suspense fallback={<CatalogFiltersSkeleton />}>
            <CatalogFilters categories={categories} brands={facets.brands} lockedCategory={lockedCategory} values={filterValues} />
          </Suspense>
        </div>
      </section>

      <section className="catalog-results page-section">
        <div className="container">
          <div className="catalog-toolbar">
            <div>
              <strong>{products.length}</strong>
              <span>{products.length === 1 ? "producto encontrado" : "productos encontrados"}</span>
            </div>
            <Suspense fallback={<CatalogViewToggleSkeleton />}>
              <CatalogViewToggle />
            </Suspense>
          </div>
          <ProductGrid products={products} variant={view} />
          <div className="catalog-help-band">
            <PackageSearch size={24} />
            <div>
              <h2>¿No encontrás la medida o el material?</h2>
              <p>Usá el centro de ayuda para buscar equivalencias, calcular cantidades o revisar disponibilidad.</p>
            </div>
            <Link className="btn btn--ghost" href="/contacto?tema=productos">
              Centro de ayuda <ArrowRight size={17} />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
