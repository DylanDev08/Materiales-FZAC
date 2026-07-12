import {
  CheckoutPaymentMethodSkeleton,
  CheckoutProductCardSkeleton,
  CheckoutStepSkeleton,
  CheckoutSummarySkeleton
} from "@/components/checkout/checkout-summary-skeleton";

export default function Loading() {
  return (
    <main className="page-section">
      <div className="container checkout-layout">
        <div className="checkout-steps">
          <CheckoutStepSkeleton />
          <div className="payment-mode-grid">
            <CheckoutPaymentMethodSkeleton />
            <CheckoutPaymentMethodSkeleton />
            <CheckoutPaymentMethodSkeleton />
          </div>
        </div>
        <aside className="checkout-summary checkout-summary-skeleton-wrap">
          <CheckoutProductCardSkeleton />
          <CheckoutProductCardSkeleton />
          <CheckoutSummarySkeleton />
        </aside>
      </div>
    </main>
  );
}
