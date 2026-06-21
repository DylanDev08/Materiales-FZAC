import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowRight, FiFilter, FiGrid, FiShoppingBag } from 'react-icons/fi';
import { productsApi } from '../../api/productsApi';
import { categories, products as mockProducts } from '../../data/mockData';
import { ProductCard } from '../../components/product/ProductCard';
import { CustomSelect } from '../../components/common/CustomSelect';
import { SearchAssist } from '../../components/common/SearchAssist';

const categoryOptions = [
  { value: '', label: 'Todas las categorias' },
  ...categories.map((category) => ({ value: category.slug, label: category.name }))
];

export const Catalog = () => {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ products: mockProducts });
  const [search, setSearch] = useState(params.get('search') || '');

  const category = params.get('category') || '';
  const onSale = params.get('onSale') === 'true';

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (search) next.set('search', search);
      else next.delete('search');
      setParams(next, { replace: true });
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    productsApi
      .list({ category, search, onSale: onSale ? 'true' : '' })
      .then((response) => setData({ products: response.products || [] }))
      .catch(() => {
        let list = mockProducts;
        if (category) list = list.filter((product) => product.categorySlug === category);
        if (onSale) list = list.filter((product) => product.onSale || product.comparePrice);
        if (search) {
          const term = search.toLowerCase();
          list = list.filter((product) => [product.name, product.sku, product.category, product.brand].join(' ').toLowerCase().includes(term));
        }
        setData({ products: list });
      });
  }, [category, search, onSale]);

  const list = data.products || [];

  const productsUrl = useMemo(() => {
    const next = new URLSearchParams();
    if (category) next.set('category', category);
    if (search) next.set('search', search);
    if (onSale) next.set('onSale', 'true');
    const query = next.toString();
    return `/productos${query ? `?${query}` : ''}`;
  }, [category, search, onSale]);

  return (
    <main className="page marketplace-page">
      <section className="market-page-hero catalog-hero-v2">
        <div className="container">
          <span className="kicker">Catalogo FZAC</span>
          <h1>Productos organizados para comprar mas rapido.</h1>
          <p>Filtra por rubro, revisa stock y abre cada producto desde una tarjeta clara de e-commerce.</p>
          <div className="catalog-steps-v2">
            <span><FiGrid /> Explora rubros</span>
            <span><FiFilter /> Filtra resultados</span>
            <span><FiShoppingBag /> Compra desde la tarjeta</span>
          </div>
        </div>
      </section>

      <section className="market-section catalog-section-v2">
        <div className="container">
          <div className="market-filter-bar catalog-filter-v2">
            <label className="market-search-field market-search-field--assist">
              <span>Buscar</span>
              <SearchAssist
                value={search}
                onChange={setSearch}
                onSubmit={setSearch}
                placeholder="Perfil, placa, cemento..."
                className="search-assist--filter"
                showButton={false}
              />
            </label>

            <CustomSelect
              label="Categoria"
              value={category}
              onChange={(value) => updateParam('category', value)}
              options={categoryOptions}
            />

            <button
              type="button"
              className={`market-toggle ${onSale ? 'active' : ''}`}
              onClick={() => updateParam('onSale', onSale ? '' : 'true')}
            >
              Solo ofertas
            </button>

            <Link className="btn" to={productsUrl}>Ver compra completa</Link>
          </div>

          <div className="catalog-results-head-v2">
            <div>
              <span className="kicker">Resultados</span>
              <h2>{onSale ? 'Ofertas disponibles' : 'Productos disponibles'}</h2>
              <p>{list.length} productos encontrados con los filtros actuales.</p>
            </div>
            <Link className="fzac-section-link" to={productsUrl}>Ir a Productos <FiArrowRight /></Link>
          </div>

          <div className="products-grid market-products-grid catalog-grid-v2">
            {list.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};
