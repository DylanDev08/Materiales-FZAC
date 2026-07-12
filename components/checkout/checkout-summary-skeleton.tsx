export function CheckoutSummarySkeleton() {
  return (
    <div className="checkout-summary-skeleton" aria-label="Cargando resumen">
      {Array.from({ length: 6 }).map((_, index) => (
        <span key={index} />
      ))}
    </div>
  );
}

export function CheckoutProductCardSkeleton() {
  return (
    <article className="checkout-product-skeleton" aria-label="Cargando producto">
      <span />
      <div>
        <span />
        <span />
        <span />
      </div>
      <span />
    </article>
  );
}

export function CheckoutPaymentMethodSkeleton() {
  return (
    <article className="checkout-payment-method-skeleton" aria-label="Cargando medio de pago">
      <span />
      <span />
      <span />
    </article>
  );
}

export function CheckoutStepSkeleton() {
  return (
    <section className="checkout-panel checkout-step-skeleton" aria-label="Cargando paso del checkout">
      <span />
      <span />
      <div>
        {Array.from({ length: 6 }).map((_, index) => (
          <span key={index} />
        ))}
      </div>
      <span />
    </section>
  );
}
