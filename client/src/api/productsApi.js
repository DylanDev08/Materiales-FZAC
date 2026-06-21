import { apiRequest } from './apiClient';
import { categories, products } from '../data/mockData';

const useMocks = () => import.meta.env.VITE_ENABLE_API_MOCKS !== 'false';
const SESSION_KEY = 'fzac_catalog_session';

const sessionId = () => {
  let value = localStorage.getItem(SESSION_KEY);
  if (!value) {
    value = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
    localStorage.setItem(SESSION_KEY, value);
  }
  return value;
};

const normalizeParams = (params = {}) => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const filterProducts = (params = {}) => {
  let list = products.filter((product) => product.active !== false);
  const category = params.category || params.categorySlug;
  if (category) list = list.filter((product) => product.categorySlug === category);
  if (params.featured === true || params.featured === 'true') list = list.filter((product) => product.featured);
  if (params.onSale === true || params.onSale === 'true') list = list.filter((product) => product.onSale);
  if (params.stock === true || params.stock === 'true' || params.stock === 'available') list = list.filter((product) => product.stock > 0);
  if (params.brand && params.brand !== 'all') list = list.filter((product) => product.brand === params.brand);
  if (params.search) {
    const search = String(params.search).toLowerCase();
    list = list.filter((product) => [product.name, product.sku, product.brand, product.category, product.subcategory, product.description].join(' ').toLowerCase().includes(search));
  }
  if (params.minPrice || params.min) list = list.filter((product) => product.price >= Number(params.minPrice || params.min));
  if (params.maxPrice || params.max) list = list.filter((product) => product.price <= Number(params.maxPrice || params.max));
  if (['price_asc', 'price-asc'].includes(params.sort)) list.sort((a, b) => a.price - b.price);
  if (['price_desc', 'price-desc'].includes(params.sort)) list.sort((a, b) => b.price - a.price);
  if (params.sort === 'newest') list.reverse();
  return {
    products: list,
    pagination: { total: list.length, page: 1, limit: list.length, pages: 1 },
    brands: [...new Set(products.map((product) => product.brand).filter(Boolean))]
  };
};

export const productsApi = {
  list: async (params = {}) => {
    try {
      return await apiRequest(`/products?${new URLSearchParams(normalizeParams(params))}`);
    } catch (error) {
      if (useMocks()) return filterProducts(params);
      throw error;
    }
  },

  getBySlug: async (slug) => {
    try {
      return await apiRequest(`/products/${slug}`);
    } catch (error) {
      if (!useMocks()) throw error;
      const product = products.find((item) => item.slug === slug);
      if (!product) throw error;
      return {
        product,
        related: products.filter((item) => item.categorySlug === product.categorySlug && item.id !== product.id).slice(0, 4)
      };
    }
  },

  brands: async () => {
    try {
      return await apiRequest('/products/brands');
    } catch {
      return [...new Set(products.map((product) => product.brand).filter(Boolean))];
    }
  },

  suggestions: async (query) => {
    if (String(query || '').trim().length < 2) return { products: [], categories: [], brands: [] };
    try {
      return await apiRequest(`/products/suggestions?${new URLSearchParams({ q: query, sessionId: sessionId() })}`);
    } catch {
      const result = filterProducts({ search: query }).products.slice(0, 8);
      return {
        products: result,
        categories: [...new Set(result.map((product) => product.category).filter(Boolean))],
        brands: [...new Set(result.map((product) => product.brand).filter(Boolean))]
      };
    }
  },

  recommendations: async (params = {}) => {
    try {
      return await apiRequest(`/products/recommendations?${new URLSearchParams(normalizeParams(params))}`);
    } catch {
      const reference = products.find((product) => product.id === params.productId || product.slug === params.slug);
      const categorySlug = params.category || reference?.categorySlug;
      const list = products
        .filter((product) => product.active && product.stock > 0 && product.id !== reference?.id)
        .sort((a, b) => Number(b.featured) - Number(a.featured));
      const matching = categorySlug ? list.filter((product) => product.categorySlug === categorySlug) : list;
      return { products: [...matching, ...list].filter((product, index, array) => array.findIndex((item) => item.id === product.id) === index).slice(0, 8) };
    }
  },

  trackEvent: async ({ productId, type, metadata }) => {
    try {
      return await apiRequest('/products/events', {
        method: 'POST',
        body: JSON.stringify({ productId, type, metadata, sessionId: sessionId() })
      });
    } catch {
      return null;
    }
  },

  publicStatistics: async () => {
    try {
      return await apiRequest('/products/statistics/public');
    } catch {
      return {
        activeProducts: products.filter((product) => product.active).length,
        onSaleProducts: products.filter((product) => product.onSale).length,
        stockUnits: products.reduce((total, product) => total + product.stock, 0),
        categories: categories.length
      };
    }
  }
};

export const categoriesApi = {
  list: async () => {
    try {
      return await apiRequest('/categories');
    } catch {
      return categories;
    }
  },
  getBySlug: async (slug) => {
    try {
      return await apiRequest(`/categories/${slug}`);
    } catch {
      return categories.find((category) => category.slug === slug);
    }
  }
};
