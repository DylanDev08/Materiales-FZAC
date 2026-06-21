import { apiRequest } from './apiClient';

export const cartApi = {
  get: () => apiRequest('/cart'),
  add: (payload) => apiRequest('/cart/items', { method: 'POST', body: JSON.stringify(payload) }),
  update: ({ itemId, productId, quantity }) => apiRequest(itemId ? `/cart/items/${itemId}` : `/cart/products/${productId}`, { method: 'PATCH', body: JSON.stringify({ quantity }) }),
  remove: ({ itemId, productId }) => apiRequest(itemId ? `/cart/items/${itemId}` : `/cart/products/${productId}`, { method: 'DELETE' }),
  clear: () => apiRequest('/cart', { method: 'DELETE' })
};
