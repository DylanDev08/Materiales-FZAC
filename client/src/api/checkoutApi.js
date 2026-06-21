import { apiRequest } from './apiClient';
export const checkoutApi = {
  createSession: (payload) => apiRequest('/checkout/create-session', { method:'POST', body: JSON.stringify(payload) }),
  getStatus: (orderId) => apiRequest(`/checkout/status/${orderId}`)
};
