export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid-skeleton" aria-label="Cargando productos">
      {Array.from({ length: count }).map((_, index) => (
        <article key={index}>
          <span className="product-grid-skeleton__media" />
          <span className="product-grid-skeleton__line product-grid-skeleton__line--short" />
          <span className="product-grid-skeleton__line" />
          <span className="product-grid-skeleton__price" />
          <span className="product-grid-skeleton__action" />
        </article>
      ))}
    </div>
  );
}

export function CatalogFiltersSkeleton() {
  return (
    <div className="catalog-filter-skeleton" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}

export function CatalogViewToggleSkeleton() {
  return <span className="catalog-view-toggle-skeleton" aria-hidden="true" />;
}

export function CatalogPageSkeleton({ title = "Productos" }: { title?: string }) {
  return (
    <main className="catalog-page catalog-page--loading" aria-busy="true">
      <section className="catalog-masthead">
        <div className="container catalog-masthead__inner">
          <div>
            <span className="skeleton-line skeleton-line--eyebrow" />
            <h1>{title}</h1>
            <span className="skeleton-line skeleton-line--lead" />
          </div>
        </div>
      </section>
      <div className="catalog-controls-shell">
        <div className="container">
          <div className="catalog-rail-skeleton">
            {Array.from({ length: 6 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <CatalogFiltersSkeleton />
        </div>
      </div>
      <section className="catalog-results page-section">
        <div className="container">
          <div className="catalog-toolbar catalog-toolbar--skeleton">
            <span />
            <span />
          </div>
          <ProductGridSkeleton />
        </div>
      </section>
    </main>
  );
}
