import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FiCheck,
  FiCreditCard,
  FiLock,
  FiMapPin,
  FiPackage,
  FiTruck,
  FiUser
} from 'react-icons/fi';

import { checkoutApi } from '../../api/checkoutApi';
import { productsApi } from '../../api/productsApi';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { currency } from '../../utils/formatters';

const initialAddress = {
  street: '',
  number: '',
  apartment: '',
  city: 'Rosario',
  province: 'Santa Fe',
  postalCode: '',
  notes: ''
};

export const Checkout = () => {
  const { user } = useAuth();
  const { items, subtotal } = useCart();
  const [shippingMethod, setShippingMethod] = useState('PICKUP');
  const [customer, setCustomer] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });
  const [address, setAddress] = useState(initialAddress);
  const [notes, setNotes] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const shippingCost = shippingMethod === 'DELIVERY' ? 6500 : 0;
  const total = subtotal + shippingCost;

  const canSubmit = useMemo(() => {
    const base = customer.name.trim() && customer.email.trim() && customer.phone.trim() && items.length > 0 && accepted;
    if (!base) return false;
    if (shippingMethod === 'DELIVERY') return address.street.trim() && address.number.trim() && address.city.trim() && address.postalCode.trim();
    return true;
  }, [customer, items.length, accepted, shippingMethod, address]);

  const submit = async (event) => {
    event.preventDefault();
    if (!canSubmit || loading) return;

    setError('');
    setLoading(true);

    try {
      await Promise.all(items.map((item) => productsApi.trackEvent({
        productId: item.productId,
        type: 'CHECKOUT',
        metadata: { quantity: item.quantity }
      })));

      const result = await checkoutApi.createSession({
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        shippingMethod,
        customer,
        address: shippingMethod === 'DELIVERY' ? address : null,
        notes
      });

      if (!result?.url) throw new Error('El proveedor de pagos no devolvió una URL válida.');
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(checkoutError.message || 'No pudimos iniciar el pago.');
      setLoading(false);
    }
  };

  if (!items.length) {
    return (
      <main className="checkout-v2">
        <div className="container checkout-empty-v2">
          <FiPackage />
          <h1>No hay productos para pagar</h1>
          <p>Agregá productos al carrito antes de iniciar el checkout.</p>
          <Link className="btn" to="/productos">Ver productos</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="checkout-v2">
      <div className="container">
        <header className="checkout-v2__head">
          <span className="kicker">Checkout seguro</span>
          <h1>Revisá los datos y pagá tu compra.</h1>
          <p>La orden se confirma cuando Mercado Pago informa el pago aprobado al backend.</p>
        </header>

        <form className="checkout-v2__layout" onSubmit={submit}>
          <div className="checkout-v2__steps">
            <section className="checkout-v2__panel">
              <div className="checkout-v2__panel-title"><FiUser /><div><span>Paso 1</span><h2>Datos del comprador</h2></div></div>
              <div className="checkout-v2__grid">
                <label>Nombre y apellido<input value={customer.name} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} required /></label>
                <label>Email<input type="email" value={customer.email} onChange={(event) => setCustomer({ ...customer, email: event.target.value })} required /></label>
                <label>Teléfono<input value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} required /></label>
              </div>
            </section>

            <section className="checkout-v2__panel">
              <div className="checkout-v2__panel-title"><FiTruck /><div><span>Paso 2</span><h2>Entrega o retiro</h2></div></div>
              <div className="checkout-shipping-v2">
                <button type="button" className={shippingMethod === 'PICKUP' ? 'active' : ''} onClick={() => setShippingMethod('PICKUP')}><FiPackage /><strong>Retiro coordinado</strong><span>Sin costo. Te avisamos cuando esté listo.</span></button>
                <button type="button" className={shippingMethod === 'DELIVERY' ? 'active' : ''} onClick={() => setShippingMethod('DELIVERY')}><FiTruck /><strong>Envío coordinado</strong><span>Tarifa base para Rosario: {currency(6500)}.</span></button>
              </div>

              {shippingMethod === 'DELIVERY' && (
                <div className="checkout-v2__grid checkout-address-v2">
                  <label>Calle<input value={address.street} onChange={(event) => setAddress({ ...address, street: event.target.value })} required /></label>
                  <label>Número<input value={address.number} onChange={(event) => setAddress({ ...address, number: event.target.value })} required /></label>
                  <label>Departamento<input value={address.apartment} onChange={(event) => setAddress({ ...address, apartment: event.target.value })} /></label>
                  <label>Ciudad<input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} required /></label>
                  <label>Provincia<input value={address.province} onChange={(event) => setAddress({ ...address, province: event.target.value })} required /></label>
                  <label>Código postal<input value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} required /></label>
                  <label className="checkout-v2__wide">Indicaciones<textarea value={address.notes} onChange={(event) => setAddress({ ...address, notes: event.target.value })} /></label>
                </div>
              )}
            </section>

            <section className="checkout-v2__panel">
              <div className="checkout-v2__panel-title"><FiCreditCard /><div><span>Paso 3</span><h2>Pago seguro</h2></div></div>
              <div className="checkout-payment-v2">
                <FiLock />
                <div><strong>Pago procesado por Mercado Pago</strong><p>Los datos de la tarjeta o billetera se cargan en el entorno seguro de Mercado Pago. Materiales FZAC no guarda números de tarjeta.</p></div>
              </div>
              <label className="checkout-notes-v2">Notas del pedido<textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength="500" placeholder="Aclaraciones sobre retiro, entrega o materiales..." /></label>
              <label className="checkout-terms-v2"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Acepto los <Link to="/terminos" target="_blank">términos y condiciones</Link> y la <Link to="/privacidad" target="_blank">política de privacidad</Link>.</span></label>
              {error && <p className="checkout-error-v2">{error}</p>}
            </section>
          </div>

          <aside className="checkout-summary-v2">
            <h2>Resumen del pedido</h2>
            <div className="checkout-summary-v2__items">
              {items.map((item) => (
                <article key={item.id}>
                  <img src={item.product.image} alt={item.product.name} />
                  <div><strong>{item.product.name}</strong><span>{item.quantity} × {currency(item.product.price)}</span></div>
                  <b>{currency(item.quantity * item.product.price)}</b>
                </article>
              ))}
            </div>
            <div className="checkout-summary-v2__line"><span>Subtotal</span><strong>{currency(subtotal)}</strong></div>
            <div className="checkout-summary-v2__line"><span>{shippingMethod === 'DELIVERY' ? 'Envío' : 'Retiro'}</span><strong>{shippingCost ? currency(shippingCost) : 'Sin costo'}</strong></div>
            <div className="checkout-summary-v2__total"><span>Total</span><strong>{currency(total)}</strong></div>
            <button className="btn full" type="submit" disabled={!canSubmit || loading}><FiLock /> {loading ? 'Iniciando pago...' : 'Pagar con Mercado Pago'}</button>
            <p><FiCheck /> El pedido solo se marca como pagado luego del webhook de Mercado Pago.</p>
          </aside>
        </form>
      </div>
    </main>
  );
};

