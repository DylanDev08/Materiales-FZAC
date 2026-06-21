import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiLock, FiPackage } from 'react-icons/fi';

import { ordersApi } from '../../api/ordersApi';
import { useAuth } from '../../context/AuthContext';
import { currency, statusLabel } from '../../utils/formatters';

const normalizeOrders = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  return [];
};

export const OrdersAccess = () => {
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const location = useLocation();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;
    setLoading(true);
    setError('');

    ordersApi
      .mine()
      .then((response) => {
        if (!mounted) return;
        setOrders(normalizeOrders(response));
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err.message || 'No pudimos cargar tus pedidos.');
        setOrders([]);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  return (
    <main className="page orders-page fzac-orders-page">
      <section className="simple-hero fzac-orders-hero">
        <div className="container">
          <span className="kicker">Pedidos</span>
          <h1>Seguimiento de pedidos.</h1>
          <p>Consultá el estado de tus compras, pagos y coordinación de entrega.</p>
        </div>
      </section>

      <section className="section">
        <div className="container order-list fzac-order-list">
          {isCheckingAuth && <p className="muted-line">Verificando sesión...</p>}

          {!isCheckingAuth && !isAuthenticated && (
            <div className="fzac-orders-empty">
              <FiLock />
              <h2>Ingresá para ver tus pedidos</h2>
              <p>Por seguridad, el seguimiento de compras está disponible solo para cuentas registradas.</p>
              <Link className="btn" to="/login" state={{ from: location.pathname }}>Ingresar</Link>
              <Link className="btn secondary" to="/productos">Seguir comprando</Link>
            </div>
          )}

          {isAuthenticated && loading && <p className="muted-line">Cargando pedidos...</p>}
          {isAuthenticated && error && <p className="error">{error}</p>}

          {isAuthenticated && !loading && !error && orders.length > 0 && (
            orders.map((order) => (
              <article className="fzac-order-card" key={order.id}>
                <div>
                  <small>Pedido</small>
                  <strong>{order.orderNumber || order.id}</strong>
                  <p>{statusLabel(order.status)}</p>
                </div>
                <b>{currency(order.total)}</b>
              </article>
            ))
          )}

          {isAuthenticated && !loading && !error && !orders.length && (
            <div className="fzac-orders-empty">
              <FiPackage />
              <h2>No tenés pedidos todavía</h2>
              <p>Cuando hagas tu primera compra, vas a poder seguir el estado desde esta sección.</p>
              <Link className="btn" to="/productos">Ver productos</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
};
