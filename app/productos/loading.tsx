import { ProductGridSkeleton } from "@/components/catalog/product-grid-skeleton";

export default function Loading() {
  return (
    <main>
      <section className="catalog-hero">
        <div className="container catalog-hero__inner">
          <div>
            <span className="kicker">Tienda online</span>
            <h1>Productos</h1>
            <p>Cargando materiales disponibles.</p>
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
