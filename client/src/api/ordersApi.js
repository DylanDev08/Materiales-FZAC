import { apiRequest } from './apiClient';

const normalizeOrders = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.orders)) return response.orders;
  if (Array.isArray(response?.data?.orders)) return response.data.orders;
  return [];
};

export const ordersApi = {
  mine: async () => normalizeOrders(await apiRequest('/orders')),
  getById: (id) => apiRequest(`/orders/${id}`),
  cancel: (id) => apiRequest(`/orders/${id}/cancel`, { method: 'PATCH' })
};
