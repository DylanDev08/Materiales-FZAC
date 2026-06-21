import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiEye, FiImage, FiShoppingCart, FiX } from 'react-icons/fi';
import { useCart } from '../../context/CartContext';
import { currency } from '../../utils/formatters';
import { toWebpImageUrl } from '../../utils/images';

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
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasStock = Number(product.stock || 0) > 0;
  const destination = linkTo || `/producto/${product.slug}`;
  const image = toWebpImageUrl(product.image || product.gallery?.[0] || '');
  const categoryName = getCategoryName(product);

  const add = () => addItem(product, 1);

  return (
    <>
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
            <div className="market-product-card__actions">
              <button
                className="btn full market-product-card__button"
                disabled={!hasStock}
                onClick={add}
              >
                <FiShoppingCart />
                {hasStock ? 'Agregar al carrito' : 'Sin stock'}
              </button>
              <button
                type="button"
                className="market-product-card__preview"
                onClick={() => setPreviewOpen(true)}
                aria-label={`Vista previa de ${product.name}`}
              >
                <FiEye />
              </button>
            </div>
          )}
        </div>
      </article>

      {previewOpen && (
        <div className="product-preview-v2" role="dialog" aria-modal="true" aria-label={`Vista previa de ${product.name}`}>
          <button className="product-preview-v2__backdrop" type="button" onClick={() => setPreviewOpen(false)} aria-label="Cerrar vista previa" />
          <article className="product-preview-v2__card">
            <button className="product-preview-v2__close" type="button" onClick={() => setPreviewOpen(false)} aria-label="Cerrar">
              <FiX />
            </button>
            <div className="product-preview-v2__media">
              {image ? <img src={image} alt={product.name} /> : <FiImage />}
            </div>
            <div className="product-preview-v2__body">
              <span className="kicker">{categoryName}</span>
              <h2>{product.name}</h2>
              <p>{product.description || 'Producto disponible para obras, reformas y mantenimiento.'}</p>
              <div className="product-preview-v2__facts">
                {product.sku && <span>SKU <strong>{product.sku}</strong></span>}
                <span>Stock <strong>{product.stock || 0}</strong></span>
                <span>Unidad <strong>{product.unit || 'unidad'}</strong></span>
              </div>
              <strong className="product-preview-v2__price">{currency(product.price)}</strong>
              <div className="product-preview-v2__actions">
                <button className="btn" type="button" disabled={!hasStock} onClick={add}>
                  <FiShoppingCart /> Agregar
                </button>
                <Link className="btn secondary" to={destination} onClick={() => setPreviewOpen(false)}>
                  Ver detalle
                </Link>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
};
