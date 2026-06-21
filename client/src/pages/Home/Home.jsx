import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FiArrowRight,
  FiBox,
  FiCheckCircle,
  FiDroplet,
  FiGrid,
  FiHome,
  FiPackage,
  FiShield,
  FiTool,
  FiTruck,
  FiZap
} from 'react-icons/fi';

import { categories as mockCategories, products as mockProducts } from '../../data/mockData';
import { productsApi } from '../../api/productsApi';
import { ProductCarousel } from '../../components/product/ProductCarousel';
import { SearchAssist } from '../../components/common/SearchAssist';

const fallbackCategories = [
  { name: 'Construcción en seco', slug: 'construccion-seca', description: 'Placas, perfiles, fijaciones y accesorios.', icon: FiHome },
  { name: 'Materiales', slug: 'materiales', description: 'Cemento, cal, áridos y productos base.', icon: FiBox },
  { name: 'Electricidad', slug: 'electricidad', description: 'Cables, cajas, térmicas y canalización.', icon: FiZap },
  { name: 'Plomería', slug: 'plomeria', description: 'Caños, conexiones y selladores.', icon: FiDroplet },
  { name: 'Pintura', slug: 'pintura', description: 'Pinturas, accesorios y terminaciones.', icon: FiGrid },
  { name: 'Herramientas', slug: 'herramientas', description: 'Herramientas manuales y eléctricas.', icon: FiTool }
];

const trustItems = [
  { title: 'Compra ordenada', text: 'Armá el carrito, revisá cantidades y avanzá al checkout sin depender de listas sueltas.', icon: FiCheckCircle },
  { title: 'Coordinación comercial', text: 'Retiro, envío y consultas se coordinan con atención FZAC.', icon: FiTruck },
  { title: 'Catálogo claro', text: 'Productos organizados por categoría para encontrar más rápido lo que necesitás.', icon: FiPackage }
];

const quickActions = [
  { title: 'Ver productos', text: 'Consultá disponibilidad, precios y stock.', to: '/productos', icon: FiPackage },
  { title: 'Ofertas', text: 'Encontrá oportunidades vigentes para obra.', to: '/ofertas', icon: FiZap },
  { title: 'Categorías', text: 'Ingresá por rubro y comprá más rápido.', to: '/categorias', icon: FiGrid }
];

const normalizeProductResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.data?.products)) return response.data.products;
  if (Array.isArray(response?.items)) return response.items;
  return [];
};

export const Home = () => {
  const [products, setProducts] = useState(mockProducts);
  const [showIntroLoader, setShowIntroLoader] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => setShowIntroLoader(false), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let mounted = true;

    productsApi
      .list({})
      .then((response) => {
        if (!mounted) return;
        const apiProducts = normalizeProductResponse(response);
        setProducts(apiProducts.length ? apiProducts : mockProducts);
      })
      .catch(() => {
        if (mounted) setProducts(mockProducts);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const source = mockCategories?.length ? mockCategories : fallbackCategories;

    return source.map((category, index) => ({
      ...category,
      icon: fallbackCategories[index]?.icon || FiGrid
    }));
  }, []);

  const featuredProducts = useMemo(() => {
    const featured = products.filter((product) => product.featured).slice(0, 12);
    return featured.length ? featured : products.slice(0, 12);
  }, [products]);

  const offerProducts = useMemo(() => {
    return products
      .filter((product) => product.onSale || product.comparePrice || product.oldPrice)
      .slice(0, 4);
  }, [products]);

  const submitSearch = (query) => {
    navigate(`/productos${query ? `?search=${encodeURIComponent(query)}` : ''}`);
  };

  return (
    <main className="page marketplace-home fzac-home">
      {showIntroLoader && (
        <div className="fzac-game-loader" role="status" aria-label="Cargando inicio">
          <div className="fzac-game-loader__box">
            <span className="kicker">Materiales FZAC</span>
            <strong>Cargando tienda</strong>
            <div className="fzac-game-loader__bar"><span /></div>
            <small>Preparando catalogo, ofertas y carrito</small>
          </div>
        </div>
      )}

      <section className="fzac-hero">
        <div className="container fzac-hero__grid">
          <div className="fzac-hero__content">
            <span className="kicker">Tienda FZAC</span>
            <h1>Materiales para obra, compra ágil y seguimiento claro.</h1>
            <p>
              Explorá el catálogo, compará productos, armá tu pedido y coordiná el pago,
              el retiro o el envío con atención comercial de FZAC.
            </p>

            <SearchAssist
              className="fzac-hero-search"
              name="search"
              placeholder="Buscar cemento, perfiles, pintura, herramientas..."
              onSubmit={submitSearch}
            />

            <div className="fzac-hero__actions">
              <Link className="fzac-btn fzac-btn--primary" to="/productos">
                Ver productos <FiArrowRight />
              </Link>

              <Link className="fzac-btn fzac-btn--ghost" to="/ofertas">
                Ver ofertas
              </Link>
            </div>
          </div>

          <aside className="fzac-hero-panel">
            <span className="fzac-hero-panel__eyebrow">Compra rápida</span>
            <h2>Compra asistida para obra y mantenimiento.</h2>
            <p>Si no encontrás un material, el buscador te sugiere alternativas y te permite pedir asistencia comercial.</p>

            <div className="fzac-hero-panel__items">
              <span><FiTruck /> Retiro/envío coordinado</span>
              <span><FiShield /> Atención comercial</span>
              <span><FiCheckCircle /> Compra organizada</span>
            </div>
          </aside>
        </div>
      </section>

      <section className="fzac-quick-section">
        <div className="container fzac-quick-grid">
          {quickActions.map(({ title, text, to, icon: Icon }) => (
            <Link key={title} to={to} className="fzac-quick-card">
              <div className="fzac-quick-card__icon"><Icon /></div>
              <div>
                <strong>{title}</strong>
                <span>{text}</span>
              </div>
              <FiArrowRight className="fzac-quick-card__arrow" />
            </Link>
          ))}
        </div>
      </section>

      <section className="fzac-categories-section">
        <div className="container">
          <div className="fzac-section-head fzac-section-head--row">
            <div>
              <span className="kicker">Categorías principales</span>
              <h2>Entrá por rubro y encontrá más rápido lo que necesitás.</h2>
              <p>Organizamos los productos por rubro para que cada compra sea más rápida, precisa y fácil de coordinar.</p>
            </div>

            <Link className="fzac-section-link" to="/categorias">
              Ver todas <FiArrowRight />
            </Link>
          </div>

          <div className="fzac-categories-grid">
            {categories.map((category, index) => {
              const Icon = category.icon || fallbackCategories[index]?.icon || FiGrid;

              return (
                <Link
                  key={category.slug || category.name}
                  to={`/productos?category=${encodeURIComponent(category.slug || category.name)}`}
                  className="fzac-category-card"
                >
                  <div className="fzac-category-card__icon"><Icon /></div>
                  <h3>{category.name}</h3>
                  <p>{category.description || 'Productos seleccionados para este rubro.'}</p>
                  <span>Ver productos <FiArrowRight /></span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="fzac-products-section">
        <div className="container">
          <ProductCarousel
            eyebrow="Destacados"
            title="Productos destacados para tu próxima compra."
            text="Una selección de materiales e insumos para consultas frecuentes y compras de obra."
            products={featuredProducts}
            action={<Link className="fzac-section-link" to="/productos">Ir a productos <FiArrowRight /></Link>}
          />
        </div>
      </section>

      {offerProducts.length > 0 && (
        <section className="fzac-products-section fzac-products-section--dark">
          <div className="container">
            <ProductCarousel
              eyebrow="Ofertas"
              title="Ofertas y oportunidades vigentes."
              text="Productos seleccionados con precio especial para compras planificadas."
              products={offerProducts}
              action={<Link className="fzac-section-link" to="/ofertas">Ver ofertas <FiArrowRight /></Link>}
            />
          </div>
        </section>
      )}

      <section className="fzac-trust-section">
        <div className="container fzac-trust-grid">
          <div className="fzac-trust-copy">
            <span className="kicker">Nosotros</span>
            <h2>Una experiencia de compra más profesional.</h2>
            <p>
              Materiales FZAC centraliza catálogo, carrito, pedidos y coordinación comercial para que cada compra sea más simple de seguir.
            </p>
            <Link className="fzac-btn fzac-btn--primary" to="/nosotros">Conocer FZAC</Link>
          </div>

          <div className="fzac-trust-list">
            {trustItems.map(({ title, text, icon: Icon }) => (
              <article key={title}>
                <Icon />
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
