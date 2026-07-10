import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";

export default function Loading() {
  return (
    <main>
      <section className="catalog-hero">
        <div className="container catalog-hero__inner">
          <div>
            <span className="kicker">Catalogo FZAC</span>
            <h1>Catálogo FZAC</h1>
            <p>Cargando productos, stock y filtros.</p>
          </div>
        </div>
      </section>
      <section className="page-section">
        <div className="container">
          <ProductGridSkeleton />
        </div>
      </section>
    </main>
  );
}
