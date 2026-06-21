import { Link } from 'react-router-dom';
import { FiImage, FiShoppingCart } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { currency } from '../../utils/formatters';

const getCategoryName = (product) => {
  if (typeof product.category === 'string') return product.category;
  return product.category?.name || product.categoryName || 'Producto';
};

const getInitials = (name = '') => {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase() || 'FZ';
};

export const ProductCard = ({ product, linkTo, showActions = true }) => {
  const { addItem } = useCart();
  const hasStock = Number(product.stock || 0) > 0;
  const destination = linkTo || `/producto/${product.slug}`;
  const image = product.image || product.gallery?.[0] || '';
  const categoryName = getCategoryName(product);

  return (
    <article className="product-card market-product-card">
      <Link to={destination} className="product-media market-product-card__media">
        {image ? (
          <img src={image} alt={product.name} loading="lazy" />
        ) : (
          <div className="market-product-card__placeholder" aria-label={`Imagen referencial de ${product.name}`}>
            <FiImage />
            <strong>{getInitials(product.name)}</strong>
            <small>{categoryName}</small>
          </div>
        )}
        <em className="market-product-card__reference">Imagen referencial</em>
        {product.onSale && <span>Oferta</span>}
      </Link>

      <div className="product-body market-product-card__body">
        <small>{categoryName}</small>

        <Link to={destination} className="market-product-card__title">
          <h3>{product.name}</h3>
        </Link>

        <div className="market-product-card__meta">
          {product.sku && <span>SKU {product.sku}</span>}
          <span>{hasStock ? `${product.stock} disponibles` : 'Sin stock'}</span>
        </div>

        <div className="price market-product-card__price">
          <strong>{currency(product.price)}</strong>
          {product.comparePrice && <em>{currency(product.comparePrice)}</em>}
        </div>

        {showActions && (
          <button
            className="btn full market-product-card__button"
            disabled={!hasStock}
            onClick={() => addItem(product, 1)}
          >
            <FiShoppingCart />
            {hasStock ? 'Agregar al carrito' : 'Sin stock'}
          </button>
        )}
      </div>
    </article>
  );
};
