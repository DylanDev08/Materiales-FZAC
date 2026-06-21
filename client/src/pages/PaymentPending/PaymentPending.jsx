import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiClock, FiRefreshCw } from 'react-icons/fi';

import { checkoutApi } from '../../api/checkoutApi';
import { currency, statusLabel } from '../../utils/formatters';

const finalStatuses = ['PAID', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];

export const PaymentPending = () => {
  const [params] = useSearchParams();
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
        if (finalStatuses.includes(nextOrder.status)) {
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

  return (
    <main className="payment-state-v2">
      <div className="payment-state-v2__card">
        <FiClock className="pending" />
        <span className="kicker">Pago pendiente</span>
        <h1>Estamos esperando la confirmación.</h1>
        <p>Mercado Pago puede dejar la operación pendiente unos minutos. Cuando el webhook confirme el pago, el pedido se actualiza y se emite el ticket automáticamente.</p>
        {order && <div className="payment-state-v2__summary"><strong>Pedido {order.id?.slice(0, 8).toUpperCase()}</strong><span>{statusLabel(order.status)}</span><b>{currency(order.total)}</b></div>}
        {checking && <div className="payment-state-v2__loader" />}
        {error && <p className="error">{error}</p>}
        <div className="payment-state-v2__actions">
          <button className="btn" type="button" onClick={() => window.location.reload()}><FiRefreshCw /> Revisar estado</button>
          <Link className="btn secondary" to="/pedidos">Ver mis pedidos</Link>
        </div>
      </div>
    </main>
  );
};
