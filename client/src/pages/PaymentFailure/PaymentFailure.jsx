import { Link, useSearchParams } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

export const PaymentFailure = () => {
  const [params] = useSearchParams();
  const orderId = params.get('order_id');

  return (
    <main className="payment-state-v2">
      <div className="payment-state-v2__card payment-state-v2__card--error">
        <FiAlertCircle className="failure" />
        <span className="kicker">Pago no completado</span>
        <h1>La compra todavía no fue confirmada.</h1>
        <p>No descontamos stock ni marcamos el pedido como pagado. Podés volver al carrito e intentar nuevamente.</p>
        {orderId && <small>Referencia: {orderId.slice(0, 8).toUpperCase()}</small>}
        <div className="payment-state-v2__actions"><Link className="btn" to="/checkout">Reintentar pago</Link><Link className="btn secondary" to="/carrito">Volver al carrito</Link></div>
      </div>
    </main>
  );
};
