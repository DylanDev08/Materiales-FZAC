import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { productsApi } from '../../api/productsApi';
import { categories, products as mockProducts } from '../../data/mockData';
import { ProductCard } from '../../components/product/ProductCard';
import { EmptyState } from '../../components/common/EmptyState';
import { CustomSelect } from '../../components/common/CustomSelect';
import { SearchAssist } from '../../components/common/SearchAssist';

const categoryOptions = [
  { value: '', label: 'Todas las categorías' },
  ...categories.map((category) => ({ value: category.slug, label: category.name }))
];

const sortOptions = [
  { value: '', label: 'Destacados' },
  { value: 'price-asc', label: 'Precio: menor a mayor' },
  { value: 'price-desc', label: 'Precio: mayor a menor' }
];

export const Products = ({ onlyOffers = false }) => {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState({ products: mockProducts });
  const [search, setSearch] = useState(params.get('search') || '');

  const category = params.get('category') || '';
  const sort = params.get('sort') || '';
  const onSale = onlyOffers || params.get('onSale') === 'true';

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
      if (onlyOffers) next.set('onSale', 'true');
      setParams(next, { replace: true });
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, onlyOffers]);

  useEffect(() => {
    productsApi
      .list({ category, search, sort, onSale: onSale ? 'true' : '' })
      .then((response) => setData({ products: response.products || [] }))
      .catch(() => {
        let list = mockProducts;
        if (category) list = list.filter((product) => product.categorySlug === category);
        if (onSale) list = list.filter((product) => product.onSale || product.comparePrice);
        if (search) {
          const term = search.toLowerCase();
          list = list.filter((product) => [product.name, product.sku, product.category, product.brand].join(' ').toLowerCase().includes(term));
        }
        if (sort === 'price_asc' || sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
        if (sort === 'price_desc' || sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
        setData({ products: list });
      });
  }, [category, search, sort, onSale]);

  const list = onlyOffers ? (data.products || []).slice(0, 4) : (data.products || []);

  return (
    <main className="page marketplace-page">
      <section className="market-page-hero market-page-hero--compact">
        <div className="container">
          <span className="kicker">{onlyOffers ? 'Ofertas FZAC' : 'Productos FZAC'}</span>
          <h1>{onlyOffers ? 'Productos con precio especial.' : 'Buscá, filtrá y armá tu pedido.'}</h1>
          <p>
            {onlyOffers
              ? 'Ofertas y oportunidades para obra, mantenimiento y reposición.'
              : 'El listado completo para comprar: imagen grande, precio claro, stock y carrito.'}
          </p>
        </div>
      </section>

      <section className="market-section">
        <div className="container">
          <div className="market-filter-bar market-filter-bar--products">
            <label className="market-search-field market-search-field--assist">
              <span>Buscar producto</span>
              <SearchAssist
                value={search}
                onChange={setSearch}
                onSubmit={setSearch}
                placeholder="Cemento, perfiles, pintura..."
                className="search-assist--filter"
                showButton={false}
              />
            </label>

            <CustomSelect label="Categoría" value={category} onChange={(value) => updateParam('category', value)} options={categoryOptions} />
            <CustomSelect label="Ordenar por" value={sort} onChange={(value) => updateParam('sort', value)} options={sortOptions} />

            {!onlyOffers && (
              <button
                type="button"
                className={`market-toggle ${onSale ? 'active' : ''}`}
                onClick={() => updateParam('onSale', onSale ? '' : 'true')}
              >
                Solo ofertas
              </button>
            )}
          </div>

          <div className="market-results-head">
            <strong>{list.length} productos encontrados</strong>
            <span>{category ? categories.find((item) => item.slug === category)?.name : 'Todas las categorías'}</span>
          </div>

          {list.length ? (
            <div className="products-grid market-products-grid">
              {list.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <EmptyState title="No encontramos productos" text="Probá ajustar la búsqueda, categoría u oferta." />
          )}
        </div>
      </section>
    </main>
  );
};
