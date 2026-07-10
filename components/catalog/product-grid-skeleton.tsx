export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="product-grid-skeleton" aria-label="Cargando productos">
      {Array.from({ length: count }).map((_, index) => (
        <article key={index} />
      ))}
    </div>
  );
}
