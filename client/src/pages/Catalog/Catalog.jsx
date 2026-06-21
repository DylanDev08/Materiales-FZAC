import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import { productsApi } from '../../api/productsApi';
import { categories, products as mockProducts } from '../../data/mockData';
import { ProductCarousel } from '../../components/product/ProductCarousel';
import { CustomSelect } from '../../components/common/CustomSelect';
import { SearchAssist } from '../../components/common/SearchAssist';

const categoryOptions = [
  { value: '', label: 'Todas las categorías' },
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
      <section className="market-page-hero">
        <div className="container">
          <span className="kicker">Catálogo FZAC</span>
          <h1>Una vista rápida de todo lo que hay.</h1>
          <p>
            Explorá productos con flechas, filtrá por categoría u oferta y, cuando
            quieras comprar, pasá a la sección Productos.
          </p>
        </div>
      </section>

      <section className="market-section">
        <div className="container">
          <div className="market-filter-bar">
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
              label="Categoría"
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

            <Link className="btn" to={productsUrl}>Comprar estos productos</Link>
          </div>

          <ProductCarousel
            eyebrow="Vista de catálogo"
            title={onSale ? 'Ofertas en catálogo.' : 'Productos disponibles.'}
            text={`${list.length} productos encontrados. Usá las flechas para recorrer.`}
            products={list}
            getLinkTo={(product) => `/productos?search=${encodeURIComponent(product.name)}`}
            action={<Link className="section-link" to={productsUrl}>Ir a Productos <FiArrowRight /></Link>}
          />
        </div>
      </section>
    </main>
  );
};
