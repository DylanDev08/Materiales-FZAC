export function CheckoutSummarySkeleton() {
  return (
    <aside className="checkout-summary checkout-summary-skeleton" aria-label="Cargando resumen">
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} />
      ))}
    </aside>
  );
}
