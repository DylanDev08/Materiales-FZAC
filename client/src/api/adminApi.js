import { apiRequest } from './apiClient';

const query = (params = {}) => new URLSearchParams(
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''))
);

export const adminApi = {
  dashboard: () => apiRequest('/admin/dashboard'),
  metrics: () => apiRequest('/admin/metrics'),
  analytics: (params = {}) => apiRequest(`/admin/analytics?${query(params)}`),
  stock: () => apiRequest('/admin/stock'),
  pickups: () => apiRequest('/admin/pickups'),
  notifications: () => apiRequest('/admin/notifications'),
  tickets: (params = {}) => apiRequest(`/admin/tickets?${query(params)}`),
  updateTicketStatus: ({ id, status }) => apiRequest(`/admin/tickets/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  payments: (params = {}) => apiRequest(`/admin/payments?${query(params)}`),
  updatePaymentStatus: ({ id, status }) => apiRequest(`/payments/admin/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  customers: () => apiRequest('/admin/customers'),
  orders: (params = {}) => apiRequest(`/admin/orders?${query(params)}`),
  updateOrderStatus: ({ id, status }) => apiRequest(`/admin/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  products: (params = {}) => apiRequest(`/admin/products?${query(params)}`),
  createProduct: (payload) => apiRequest('/admin/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: ({ id, payload }) => apiRequest(`/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteProduct: (id) => apiRequest(`/admin/products/${id}`, { method: 'DELETE' }),
  categories: () => apiRequest('/admin/categories'),
  createCategory: (payload) => apiRequest('/admin/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: ({ id, payload }) => apiRequest(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  deleteCategory: (id) => apiRequest(`/admin/categories/${id}`, { method: 'DELETE' }),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file);
    return apiRequest('/admin/uploads/image', { method: 'POST', body: formData });
  }
};
