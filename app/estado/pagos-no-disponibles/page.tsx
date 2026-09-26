import Link from "next/link";
import { CreditCard, Home, ShoppingCart } from "lucide-react";

export const metadata = { title: "Pagos temporalmente no disponibles", robots: { index: false, follow: false } };

export default function PaymentsUnavailablePage() {
  return (
    <main className="status-page">
      <section className="status-page__card">
        <div className="status-page__code" aria-hidden="true"><span>PAGOS EN PAUSA</span><strong>!</strong></div>
        <div className="status-page__content">
          <span className="status-page__eyebrow"><CreditCard size={17} /> Cobro protegido</span>
          <h1>No podemos iniciar un pago ahora.</h1>
          <p>El catálogo puede seguir disponible, pero el proveedor de pagos o su configuración no está listo. Tu carrito no debería requerir que ingreses datos de tarjeta fuera del checkout oficial.</p>
          <div className="status-page__detail">Si Mercado Pago ya debitó un importe, no vuelvas a pagar. Revisá primero tu pedido o contactanos para conciliación.</div>
          <div className="status-page__actions">
            <Link className="btn" href="/carrito"><ShoppingCart size={17} /> Volver al carrito</Link>
            <Link className="btn btn--ghost" href="/"><Home size={17} /> Inicio</Link>
          </div>
        </div>
      </section>
    </main>
  );
}