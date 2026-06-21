import { apiRequest } from './apiClient';

export const assistantApi = {
  chat: (payload) => apiRequest('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify(payload)
  }),
  conversations: () => apiRequest('/assistant/conversations'),
  conversation: (id) => apiRequest(`/assistant/conversations/${id}`),
  requestAdmin: (id) => apiRequest(`/assistant/conversations/${id}/request-admin`, { method: 'POST' }),
  userMessage: (id, message) => apiRequest(`/assistant/conversations/${id}/message`, { method: 'POST', body: JSON.stringify({ message }) }),
  adminConversations: () => apiRequest('/assistant/admin/conversations'),
  adminReply: (id, message) => apiRequest(`/assistant/admin/conversations/${id}/reply`, {
    method: 'POST',
    body: JSON.stringify({ message })
  }),
  adminStatus: (id, status) => apiRequest(`/assistant/admin/conversations/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status })
  })
};
