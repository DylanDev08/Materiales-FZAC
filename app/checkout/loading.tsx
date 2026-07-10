import { CheckoutSummarySkeleton } from "@/components/checkout/checkout-summary-skeleton";

export default function Loading() {
  return (
    <main className="page-section">
      <div className="container checkout-layout">
        <section className="checkout-panel">
          <span className="kicker">Checkout FZAC</span>
          <h1>Preparando tu compra</h1>
          <p className="checkout-summary__payment">Estamos cargando carrito, stock y medios de pago.</p>
        </section>
        <CheckoutSummarySkeleton />
      </div>
    </main>
  );
}
