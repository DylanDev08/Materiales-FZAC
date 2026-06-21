import { Link } from 'react-router-dom';
import { FiMinus, FiPlus, FiShoppingBag, FiTrash2 } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { currency } from '../../utils/formatters';
import fallbackMaterialImage from '../../assets/products/fallback-material.svg';

const getProductImage = (product) => {
  return product?.image || product?.gallery?.[0] || fallbackMaterialImage;
};

export const Cart = () => {
  const { items, subtotal, updateQuantity, removeItem } = useCart();
  const isEmpty = !items.length;

  return (
    <main className="page cart-page fzac-cart-page">
      <section className="simple-hero fzac-cart-hero">
        <div className="container">
          <span className="kicker">Carrito</span>
          <h1>Tu compra.</h1>
          <p>Revisá productos, cantidades y subtotal antes de pasar al checkout.</p>
        </div>
      </section>

      <section className="section fzac-cart-section">
        <div className="container cart-layout fzac-cart-layout">
          <div className="cart-list fzac-cart-list">
            {isEmpty ? (
              <div className="fzac-cart-empty">
                <FiShoppingBag />
                <h2>Tu carrito está vacío</h2>
                <p>Agregá productos desde el catálogo o desde ofertas para continuar con tu compra.</p>
                <div className="fzac-cart-empty__actions">
                  <Link className="btn" to="/productos">Ver productos</Link>
                  <Link className="btn secondary" to="/ofertas">Ver ofertas</Link>
                </div>
              </div>
            ) : (
              items.map((item) => {
                const product = item.product || {};
                const quantity = Number(item.quantity || 1);
                const price = Number(product.price || 0);
                const itemTotal = price * quantity;

                return (
                  <article className="fzac-cart-item" key={item.id || item.productId}>
                    <Link to={`/producto/${product.slug || item.productId}`} className="fzac-cart-item__image">
                      <img src={getProductImage(product)} alt={product.name || 'Producto FZAC'} />
                    </Link>

                    <div className="fzac-cart-item__info">
                      <small>{product.category || product.categoryName || 'Producto'}</small>
                      <h3>{product.name || 'Producto FZAC'}</h3>
                      <p>{currency(price)} por unidad</p>
                    </div>

                    <div className="fzac-cart-qty" aria-label="Cantidad">
                      <button type="button" onClick={() => updateQuantity(item.id || item.productId, Math.max(quantity - 1, 1))}>
                        <FiMinus />
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(event) => updateQuantity(item.id || item.productId, event.target.value)}
                      />
                      <button type="button" onClick={() => updateQuantity(item.id || item.productId, quantity + 1)}>
                        <FiPlus />
                      </button>
                    </div>

                    <strong className="fzac-cart-item__total">{currency(itemTotal)}</strong>

                    <button className="fzac-cart-remove" type="button" onClick={() => removeItem(item.id || item.productId)}>
                      <FiTrash2 />
                      Quitar
                    </button>
                  </article>
                );
              })
            )}
          </div>

          <aside className="summary fzac-cart-summary">
            <h2>Resumen</h2>
            <div className="fzac-cart-summary__row">
              <span>Subtotal</span>
              <strong>{currency(subtotal)}</strong>
            </div>
            <Link className={`btn full ${isEmpty ? 'disabled-link' : ''}`} to={isEmpty ? '/productos' : '/checkout'}>
              {isEmpty ? 'Elegir productos' : 'Finalizar compra'}
            </Link>
            <Link className="btn secondary full" to="/productos">Seguir comprando</Link>
          </aside>
        </div>
      </section>
    </main>
  );
};
