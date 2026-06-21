import { apiRequest, setAccessToken } from './apiClient';

const save = (data) => {
  if (data?.accessToken) setAccessToken(data.accessToken);
  if (data?.user) localStorage.setItem('fzac_user', JSON.stringify(data.user));
  return data;
};

export const authApi = {
  login: async (payload) => save(await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify(payload) })),
  oauthSupabase: async (payload) => save(await apiRequest('/auth/oauth/supabase', { method: 'POST', body: JSON.stringify(payload) })),
  register: async (payload) => save(await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) })),
  refresh: async () => save(await apiRequest('/auth/refresh', { method: 'POST', body: JSON.stringify({}) })),
  me: async () => (await apiRequest('/auth/me')).user,
  accountSummary: async () => apiRequest('/account/summary'),
  updateSettings: async (payload) => apiRequest('/account/settings', { method: 'PATCH', body: JSON.stringify(payload) }),
  changePassword: async (payload) => apiRequest('/account/security/password', { method: 'POST', body: JSON.stringify(payload) }),
  favorites: async () => apiRequest('/account/favorites'),
  addFavorite: async (productId) => apiRequest(`/account/favorites/${productId}`, { method: 'POST' }),
  removeFavorite: async (productId) => apiRequest(`/account/favorites/${productId}`, { method: 'DELETE' }),
  logout: async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } finally {
      setAccessToken(null);
      localStorage.removeItem('fzac_user');
    }
  }
};
