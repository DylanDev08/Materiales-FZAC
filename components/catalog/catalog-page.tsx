import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Boxes, ChevronRight, Hammer, Layers3, PackageSearch, PaintRoller, PanelsTopLeft, Ruler, Wrench } from "lucide-react";
import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { ProductGrid } from "@/components/catalog/product-grid";
import { CatalogFiltersSkeleton, CatalogViewToggleSkeleton } from "@/components/catalog/product-grid-skeleton";
import { CatalogViewToggle } from "@/components/catalog/catalog-view-toggle";
import { AdminProductsManager } from "@/components/admin/admin-products-manager";
import { getUserProfile } from "@/lib/auth/get-user";
import { getAdminCategories, getAdminProducts, getAdminSuppliers } from "@/lib/db/admin";
import { getCatalogFacets, getCategories, getProducts } from "@/lib/db/catalog";
import type { ProductFilters } from "@/lib/db/catalog";

type SearchParams = Record<string, string | string[] | undefined>;

const projectShortcuts = [
  {
    label: "Hacer una pared",
    helper: "Placas, perfiles y terminación",
    href: "/productos?search=pared",
    icon: Ruler
  },
  {
    label: "Construcción en seco",
    helper: "Placas, perfiles, masilla y tornillos",
    href: "/categoria/construccion-en-seco",
    icon: Boxes
  },
  {
    label: "Steel Framing",
    helper: "Perfiles estructurales y placas exteriores",
    href: "/categoria/steel-framing",
    icon: Layers3
  },
  {
    label: "Colocar cielorraso",
    helper: "Placas, PVC y perfilería",
    href: "/productos?search=cielorraso",
    icon: PanelsTopLeft
  },
  {
    label: "Ferretería",
    helper: "Tornillos, tarugos y fijaciones",
    href: "/categoria/ferreteria",
    icon: Hammer
  },
  {
    label: "Pinturas",
    helper: "Látex, esmaltes e impermeabilizantes",
    href: "/categoria/pintura-impermeabilizacion",
    icon: PaintRoller
  }
];

const CATALOG_PAGE_SIZE = 120;

function value(params: SearchParams, key: string) {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
}

function catalogPageHref(searchParams: SearchParams, page: number) {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(searchParams)) {
    const current = Array.isArray(raw) ? raw[0] : raw;
    if (current && key !== "page") params.set(key, current);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `?${query}` : "?";
}

export async function CatalogPage({
  searchParams,
  title = "Catálogo FZAC",
  description,
  forcedFilters = {},
  showAdminProductLoader = false
}: {
  searchParams: SearchParams;
  title?: string;
  description?: string;
  forcedFilters?: ProductFilters;
  showAdminProductLoader?: boolean;
}) {
  const requestedPage = Number.parseInt(value(searchParams, "page") ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100) : 1;
  const filters: ProductFilters = {
    search: value(searchParams, "search"),
    category: value(searchParams, "category"),
    brand: value(searchParams, "brand"),
    minPrice: value(searchParams, "minPrice") ? Number(value(searchParams, "minPrice")) : undefined,
    maxPrice: value(searchParams, "maxPrice") ? Number(value(searchParams, "maxPrice")) : undefined,
    inStock: value(searchParams, "inStock") === "true",
    availability: ["IN_STOCK", "CONSULT", "OUT_OF_STOCK"].includes(value(searchParams, "availability") ?? "")
      ? value(searchParams, "availability") as ProductFilters["availability"]
      : undefined,
    onSale: value(searchParams, "onSale") === "true",
    featured: value(searchParams, "featured") === "true",
    order: value(searchParams, "order") as ProductFilters["order"],
    limit: CATALOG_PAGE_SIZE + 1,
    offset: (page - 1) * CATALOG_PAGE_SIZE,
    ...forcedFilters
  };

  const [categories, fetchedProducts, facets, profile] = await Promise.all([
    getCategories(),
    getProducts(filters),
    getCatalogFacets(),
    getUserProfile()
  ]);
  const hasNextPage = fetchedProducts.length > CATALOG_PAGE_SIZE;
  const products = fetchedProducts.slice(0, CATALOG_PAGE_SIZE);
  const isAdmin = profile?.role === "ADMIN";
  const adminProductData = isAdmin && showAdminProductLoader
    ? await Promise.all([getAdminProducts(), getAdminCategories(), getAdminSuppliers()])
    : null;
  const filterValues = {
    search: value(searchParams, "search"),
    category: forcedFilters.category ?? value(searchParams, "category"),
    brand: value(searchParams, "brand"),
    minPrice: value(searchParams, "minPrice"),
    maxPrice: value(searchParams, "maxPrice"),
    order: value(searchParams, "order"),
    inStock: value(searchParams, "inStock"),
    availability: value(searchParams, "availability"),
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
          <Link className="catalog-masthead__categories" href="/categorias" prefetch={false}>
            <Boxes size={22} />
            <span>
              <small>Explorar por proyecto</small>
              <strong>Ver todos los rubros</strong>
            </span>
            <ChevronRight size={18} />
          </Link>
        </div>
      </section>

      {adminProductData ? (
        <section className="catalog-admin-entry">
          <div className="container">
            <AdminProductsManager products={adminProductData[0]} categories={adminProductData[1]} suppliers={adminProductData[2]} mode="create-only" />
          </div>
        </section>
      ) : null}

      <section className="catalog-projects">
        <div className="container">
          <div className="catalog-projects__head">
            <div>
              <span className="kicker">Compra guiada</span>
              <h2>Elegí por lo que vas a hacer</h2>
            </div>
            <Link className="catalog-projects__help" href="/contacto?tema=productos" prefetch={false}>
              <Wrench size={16} />
              Asesoramiento
            </Link>
          </div>
          <div className="catalog-projects__rail" aria-label="Comprar por proyecto">
            {projectShortcuts.map(({ href, icon: Icon, label, helper }) => (
              <Link href={href} key={label} prefetch={false}>
                <span><Icon size={18} /></span>
                <strong>{label}</strong>
                <small>{helper}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="catalog-controls-shell">
        <div className="container">
          <nav className="catalog-category-rail" aria-label="Rubros de productos">
            <Link href="/productos" className={!lockedCategory ? "is-active" : ""} prefetch={false}>
              Todos
            </Link>
            {categories.map((category) => (
              <Link
                href={`/categoria/${category.slug}`}
                className={lockedCategory === category.slug ? "is-active" : ""}
                key={category.id}
                prefetch={false}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="catalog-results page-section">
        <div className="container catalog-commerce-layout">
          <Suspense fallback={<CatalogFiltersSkeleton />}>
            <CatalogFilters categories={categories} brands={facets.brands} lockedCategory={lockedCategory} values={filterValues} />
          </Suspense>
          <div className="catalog-product-column">
            <div className="catalog-toolbar">
              <div>
                <strong>{products.length}</strong>
                <span>{products.length === 1 ? "producto en esta página" : "productos en esta página"}{page > 1 ? ` · Página ${page}` : ""}</span>
              </div>
              <Suspense fallback={<CatalogViewToggleSkeleton />}>
                <CatalogViewToggle />
              </Suspense>
            </div>
            <ProductGrid products={products} variant={view} />
            {page > 1 || hasNextPage ? (
              <nav className="catalog-pagination" aria-label="Páginas del catálogo">
                {page > 1 ? (
                  <Link className="btn btn--ghost" href={catalogPageHref(searchParams, page - 1)} scroll>
                    <ArrowLeft size={17} /> Anterior
                  </Link>
                ) : <span />}
                <strong>Página {page}</strong>
                {hasNextPage ? (
                  <Link className="btn btn--ghost" href={catalogPageHref(searchParams, page + 1)} scroll>
                    Siguiente <ArrowRight size={17} />
                  </Link>
                ) : <span />}
              </nav>
            ) : null}
            <div className="catalog-help-band">
              <PackageSearch size={24} />
              <div>
                <h2>¿No encontrás la medida o el material?</h2>
                <p>Usá el centro de ayuda para buscar equivalencias, calcular cantidades o revisar disponibilidad.</p>
              </div>
              <Link className="btn btn--ghost" href="/contacto?tema=productos" prefetch={false}>
                Centro de ayuda <ArrowRight size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
