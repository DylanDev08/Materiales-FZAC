import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiClock } from 'react-icons/fi';

import { checkoutApi } from '../../api/checkoutApi';
import { useCart } from '../../context/CartContext';
import { currency, statusLabel } from '../../utils/formatters';

const paidStatuses = ['PAID', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED'];

export const PaymentSuccess = () => {
  const [params] = useSearchParams();
  const { clearCart } = useCart();
  const orderId = params.get('order_id') || params.get('orderId');
  const [order, setOrder] = useState(null);
  const [checking, setChecking] = useState(Boolean(orderId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setChecking(false);
      return undefined;
    }

    let active = true;
    let attempts = 0;

    const check = async () => {
      try {
        const response = await checkoutApi.getStatus(orderId);
        if (!active) return;
        const nextOrder = response.order || response;
        setOrder(nextOrder);
        if (paidStatuses.includes(nextOrder.status)) {
          clearCart();
          setChecking(false);
          return;
        }
      } catch (statusError) {
        if (active) setError(statusError.message || 'No pudimos verificar el pedido.');
      }

      attempts += 1;
      if (active && attempts < 8) window.setTimeout(check, 1800);
      else if (active) setChecking(false);
    };

    check();
    return () => { active = false; };
  }, [orderId]);

  const paid = order && paidStatuses.includes(order.status);

  return (
    <main className="payment-state-v2">
      <div className="payment-state-v2__card">
        {paid ? <FiCheckCircle className="success" /> : <FiClock className="pending" />}
        <span className="kicker">{paid ? 'Pago aprobado' : 'Verificando pago'}</span>
        <h1>{paid ? 'Tu compra quedó confirmada.' : 'Estamos confirmando la operación.'}</h1>
        <p>{paid ? 'El pedido ya está registrado en Materiales FZAC y puede gestionarse desde tu cuenta.' : 'Mercado Pago puede tardar unos segundos en notificar el pago al servidor. No cierres esta pantalla.'}</p>
        {order && <div className="payment-state-v2__summary"><strong>Pedido {order.id?.slice(0, 8).toUpperCase()}</strong><span>{statusLabel(order.status)}</span><b>{currency(order.total)}</b></div>}
        {checking && <div className="payment-state-v2__loader" />}
        {error && <p className="error">{error}</p>}
        <div className="payment-state-v2__actions"><Link className="btn" to="/pedidos">Ver mis pedidos</Link><Link className="btn secondary" to="/productos">Seguir comprando</Link></div>
      </div>
    </main>
  );
};
