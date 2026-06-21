import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight, FiMessageCircle, FiPackage, FiSearch, FiTag } from 'react-icons/fi';

import { categories, products as mockProducts } from '../../data/mockData';
import { productsApi } from '../../api/productsApi';

const normalize = (value = '') => {
  return String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
};

const buildSuggestionText = (product) => {
  const categoryName = typeof product.category === 'string' ? product.category : product.category?.name;

  return [product.name, product.sku, product.brand, categoryName, product.categorySlug, product.description]
    .filter(Boolean)
    .join(' ');
};

const normalizeProductsResponse = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.products)) return response.products;
  if (Array.isArray(response?.data?.products)) return response.data.products;
  return [];
};

const getProductCategory = (product) => {
  if (typeof product.category === 'string') return product.category;
  return product.category?.name || product.categoryName || 'Producto';
};

export const SearchAssist = ({
  value,
  defaultValue = '',
  onChange,
  onSubmit,
  placeholder = 'Buscar materiales, herramientas, perfiles...',
  buttonLabel = 'Buscar',
  className = '',
  name = 'search',
  showButton = true
}) => {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [internalValue, setInternalValue] = useState(defaultValue);
  const [focused, setFocused] = useState(false);
  const [remoteProducts, setRemoteProducts] = useState([]);

  const query = value ?? internalValue;
  const normalizedQuery = normalize(query);

  useEffect(() => {
    if (normalizedQuery.length < 1) {
      setRemoteProducts([]);
      return;
    }

    let mounted = true;
    const timer = setTimeout(() => {
      productsApi
        .suggestions(query)
        .then((response) => {
          if (!mounted) return;
          setRemoteProducts(normalizeProductsResponse(response).slice(0, 8));
        })
        .catch(() => {
          if (!mounted) return;
          setRemoteProducts([]);
        });
    }, 180);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [normalizedQuery, query]);

  const suggestions = useMemo(() => {
    if (normalizedQuery.length < 1) return [];

    const categoryMatches = categories
      .filter((category) => normalize(`${category.name} ${category.description}`).includes(normalizedQuery))
      .slice(0, 2)
      .map((category) => ({
        type: 'category',
        id: `category-${category.slug}`,
        title: category.name,
        detail: 'Ver productos de esta categoría',
        to: `/productos?category=${encodeURIComponent(category.slug)}`
      }));

    const productSource = remoteProducts.length ? remoteProducts : mockProducts;

    const productMatches = productSource
      .filter((product) => normalize(buildSuggestionText(product)).includes(normalizedQuery))
      .slice(0, 6)
      .map((product) => ({
        type: 'product',
        id: product.id || product.slug,
        title: product.name,
        detail: `${getProductCategory(product)}${product.brand ? ` · ${product.brand}` : ''}`,
        to: product.slug ? `/producto/${product.slug}` : `/productos?search=${encodeURIComponent(product.name)}`
      }));

    return [...productMatches, ...categoryMatches].slice(0, 7);
  }, [normalizedQuery, remoteProducts]);

  const hasAssist = focused && normalizedQuery.length >= 1;

  useEffect(() => {
    const close = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setFocused(false);
      }
    };

    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const updateQuery = (nextValue) => {
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextValue);
  };

  const submit = (event) => {
    event.preventDefault();

    const cleanQuery = String(query || '').trim();
    setFocused(false);

    if (onSubmit) {
      onSubmit(cleanQuery);
      return;
    }

    navigate(`/productos${cleanQuery ? `?search=${encodeURIComponent(cleanQuery)}` : ''}`);
  };

  const goTo = (to) => {
    setFocused(false);
    if (value === undefined) setInternalValue('');
    navigate(to);
  };

  return (
    <form ref={rootRef} className={`search-assist ${className}`} onSubmit={submit}>
      <FiSearch className="search-assist__icon" />

      <input
        name={name}
        value={query}
        onChange={(event) => updateQuery(event.target.value)}
        onFocus={() => setFocused(true)}
        placeholder={placeholder}
        autoComplete="off"
      />

      {showButton && <button type="submit">{buttonLabel}</button>}

      {hasAssist && (
        <div className="search-assist__panel">
          {suggestions.length > 0 ? (
            suggestions.map((suggestion) => {
              const Icon = suggestion.type === 'category' ? FiTag : FiPackage;

              return (
                <button
                  key={suggestion.id}
                  type="button"
                  className="search-assist__item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goTo(suggestion.to)}
                >
                  <span className="search-assist__item-icon"><Icon /></span>
                  <span>
                    <strong>{suggestion.title}</strong>
                    <small>{suggestion.detail}</small>
                  </span>
                  <FiArrowRight />
                </button>
              );
            })
          ) : (
            <button
              type="button"
              className="search-assist__item search-assist__item--help"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => goTo(`/contacto?consulta=${encodeURIComponent(query)}`)}
            >
              <span className="search-assist__item-icon"><FiMessageCircle /></span>
              <span>
                <strong>Solicitar asistencia comercial</strong>
                <small>Consultar disponibilidad por “{query}”</small>
              </span>
              <FiArrowRight />
            </button>
          )}
        </div>
      )}
    </form>
  );
};

export default SearchAssist;
