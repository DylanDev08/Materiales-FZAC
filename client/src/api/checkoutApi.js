import { apiRequest } from './apiClient';
export const checkoutApi = {
  createSession: (payload) => apiRequest('/checkout/create-session', { method:'POST', body: JSON.stringify(payload) }),
  simulatePayment: ({ orderId, status }) => apiRequest(`/checkout/simulate/${orderId}`, { method: 'POST', body: JSON.stringify({ status }) }),
  getStatus: (orderId) => apiRequest(`/checkout/status/${orderId}`)
};
