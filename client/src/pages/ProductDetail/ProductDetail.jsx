import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  FiArrowLeft,
  FiCheck,
  FiHeart,
  FiMinus,
  FiPlus,
  FiShield,
  FiShoppingCart,
  FiTruck
} from 'react-icons/fi';

import { productsApi } from '../../api/productsApi';
import { products as mockProducts } from '../../data/mockData';
import { authApi } from '../../api/authApi';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { currency } from '../../utils/formatters';
import { ProductCard } from '../../components/product/ProductCard';

const normalizeSpecifications = (specifications) => {
  if (Array.isArray(specifications)) {
    return specifications.map((item, index) => ({
      label: item.label || item.name || `Detalle ${index + 1}`,
      value: item.value || item.description || String(item)
    }));
  }

  if (specifications && typeof specifications === 'object') {
    return Object.entries(specifications).map(([label, value]) => ({ label, value: String(value) }));
  }

  return [];
};

export const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();

  const [data, setData] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    const fallbackProduct = mockProducts.find((item) => item.slug === slug);
    if (fallbackProduct) {
      setData({
        product: fallbackProduct,
        related: mockProducts
          .filter((item) => item.categorySlug === fallbackProduct.categorySlug && item.id !== fallbackProduct.id)
          .slice(0, 4),
        fallback: true
      });
      setActiveImage(fallbackProduct.image || '');
    } else {
      setData(null);
    }

    productsApi
      .getBySlug(slug)
      .then((response) => {
        if (!mounted) return;
        setData(response);
        setActiveImage(response?.product?.image || '');
        if (response?.product?.id) {
          productsApi.trackEvent({ productId: response.product.id, type: 'VIEW', metadata: { slug } });
        }
      })
      .catch(() => {
        if (mounted) setData({ product: null, related: [] });
      });

    return () => {
      mounted = false;
    };
  }, [slug]);

  const product = data?.product;
  const gallery = useMemo(() => {
    if (!product) return [];
    return [...new Set([product.image, ...(product.gallery || [])].filter(Boolean))];
  }, [product]);

  const specifications = useMemo(
    () => normalizeSpecifications(product?.specifications),
    [product]
  );

  const decrease = () => setQuantity((current) => Math.max(1, current - 1));
  const increase = () => setQuantity((current) => Math.min(Number(product?.stock || 1), current + 1));

  const add = async () => {
    await addItem(product, quantity);
    setNotice(`${quantity} ${quantity === 1 ? 'unidad agregada' : 'unidades agregadas'} al carrito.`);
  };

  const buyNow = async () => {
    await add();
    navigate('/carrito');
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate('/login', { state: { from: `/producto/${slug}` } });
      return;
    }

    try {
      if (favorite) await authApi.removeFavorite(product.id);
      else {
        await authApi.addFavorite(product.id);
        productsApi.trackEvent({ productId: product.id, type: 'FAVORITE' });
      }
      setFavorite((current) => !current);
    } catch (error) {
      setNotice(error.message || 'No pudimos actualizar favoritos.');
    }
  };

  if (!data) {
    return (
      <main className="page">
        <section className="container section"><p>Cargando producto...</p></section>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="page">
        <section className="container section product-not-found-v2">
          <h1>Producto no encontrado</h1>
          <p>Puede haberse desactivado o cambiado de dirección.</p>
          <Link className="btn" to="/catalogo">Volver al catálogo</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page product-detail-page-v2">
      <section className="container product-detail-v2">
        <Link to="/catalogo" className="back product-back-v2"><FiArrowLeft /> Volver al catálogo</Link>

        <div className="product-detail-v2__grid">
          <div className="product-gallery-v2">
            <div className="product-gallery-v2__main">
              <img src={activeImage || product.image} alt={product.name} />
              {product.onSale && <span>Oferta</span>}
            </div>

            {gallery.length > 1 && (
              <div className="product-gallery-v2__thumbs">
                {gallery.map((image) => (
                  <button
                    key={image}
                    type="button"
                    className={activeImage === image ? 'active' : ''}
                    onClick={() => setActiveImage(image)}
                  >
                    <img src={image} alt={`Vista de ${product.name}`} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="product-buy-card-v2">
            <span className="kicker">{product.category?.name || product.category}</span>
            <h1>{product.name}</h1>
            <p className="product-buy-card-v2__description">{product.description}</p>

            <div className="product-buy-card-v2__meta">
              <span>Marca<b>{product.brand}</b></span>
              <span>SKU<b>{product.sku}</b></span>
              <span>Unidad<b>{product.unit || 'unidad'}</b></span>
            </div>

            <div className="product-buy-card-v2__price">
              <strong>{currency(product.price)}</strong>
              {product.comparePrice && <del>{currency(product.comparePrice)}</del>}
            </div>

            <div className={`product-buy-card-v2__stock ${product.stock <= 0 ? 'out' : ''}`}>
              <FiCheck /> {product.stock > 0 ? `${product.stock} unidades disponibles` : 'Sin stock disponible'}
            </div>

            <div className="product-buy-card-v2__actions">
              <div className="product-buy-card-v2__qty">
                <button type="button" onClick={decrease} aria-label="Reducir cantidad"><FiMinus /></button>
                <input
                  type="number"
                  min="1"
                  max={product.stock}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.min(Math.max(Number(event.target.value || 1), 1), product.stock || 1))}
                />
                <button type="button" onClick={increase} aria-label="Aumentar cantidad"><FiPlus /></button>
              </div>

              <button className="btn" type="button" disabled={product.stock <= 0} onClick={add}>
                <FiShoppingCart /> Agregar al carrito
              </button>
            </div>

            <button className="btn secondary full product-buy-now-v2" type="button" disabled={product.stock <= 0} onClick={buyNow}>
              Comprar ahora
            </button>

            <button className={`product-buy-card-v2__favorite ${favorite ? 'active' : ''}`} type="button" onClick={toggleFavorite}>
              <FiHeart /> {favorite ? 'Guardado en favoritos' : 'Guardar en favoritos'}
            </button>

            {notice && <p className="product-notice-v2">{notice}</p>}

            <div className="product-promise-v2">
              <span><FiShield /> Pago protegido mediante Mercado Pago</span>
              <span><FiTruck /> Retiro o entrega coordinada</span>
            </div>
          </aside>
        </div>

        <div className="product-info-v2">
          <article>
            <span className="kicker">Descripción</span>
            <h2>Información del producto</h2>
            <p>{product.description}</p>
            <p>Antes de comprar, verificá la medida, el uso recomendado y la compatibilidad con tu proyecto. Para aplicaciones técnicas, consultá a un profesional.</p>
          </article>

          <article>
            <span className="kicker">Ficha técnica</span>
            <h2>Especificaciones</h2>
            <div className="product-spec-list-v2">
              {specifications.map((specification) => (
                <div key={`${specification.label}-${specification.value}`}>
                  <span>{specification.label}</span>
                  <strong>{specification.value}</strong>
                </div>
              ))}
              <div><span>Stock</span><strong>{product.stock}</strong></div>
              <div><span>Categoría</span><strong>{product.category?.name || product.category}</strong></div>
            </div>
          </article>
        </div>
      </section>

      {data.related?.length > 0 && (
        <section className="section product-related-v2">
          <div className="container">
            <div className="section-title">
              <div><span>Relacionados</span><h2>Completá tu compra.</h2></div>
              <Link to={`/productos?category=${product.categorySlug || product.category?.slug || ''}`}>Ver rubro</Link>
            </div>
            <div className="products-grid">
              {data.related.map((related) => <ProductCard key={related.id} product={related} />)}
            </div>
          </div>
        </section>
      )}
    </main>
  );
};
