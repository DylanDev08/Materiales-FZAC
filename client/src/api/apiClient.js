const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

const getToken = () => accessToken;

const friendlyNetworkMessage =
  'No pudimos conectar con el servidor. Revisá que el backend esté iniciado y volvé a intentar.';

const friendlyStatusMessages = {
  400: 'La solicitud no se pudo procesar. Revisá los datos cargados.',
  401: 'La sesión venció o las credenciales no son válidas.',
  403: 'No tenés permisos para realizar esta acción.',
  404: 'No encontramos la información solicitada.',
  409: 'La operación entra en conflicto con datos existentes.',
  429: 'Demasiados intentos. Esperá unos minutos y volvé a probar.',
  500: 'El servidor no pudo completar la operación. Intentá nuevamente en unos minutos.'
};

export const getFriendlyApiError = (error) => {
  if (!error) return 'No pudimos completar la operación.';
  if (error.isNetworkError) return friendlyNetworkMessage;
  if (error.status && friendlyStatusMessages[error.status]) {
    return error.data?.message || error.message || friendlyStatusMessages[error.status];
  }
  if (error.message === 'Failed to fetch') return friendlyNetworkMessage;
  return error.message || 'No pudimos completar la operación.';
};

const refreshSession = async () => {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    if (!response.ok) return false;

    const payload = await response.json();
    const data = payload?.data || payload;

    if (!data?.accessToken) return false;

    setAccessToken(data.accessToken);
    if (data.user) localStorage.setItem('fzac_user', JSON.stringify(data.user));
    return true;
  } catch {
    return false;
  }
};

export const apiRequest = async (path, options = {}, internal = {}) => {
  const headers = new Headers(options.headers || {});
  const token = getToken();

  if (token) headers.set('Authorization', `Bearer ${token}`);

  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  let response;

  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include'
    });
  } catch (error) {
    const networkError = new Error(friendlyNetworkMessage);
    networkError.isNetworkError = true;
    networkError.cause = error;
    throw networkError;
  }

  if (response.status === 401 && !internal.didRefresh && !path.startsWith('/auth/')) {
    const refreshed = await refreshSession();
    if (refreshed) return apiRequest(path, options, { didRefresh: true });
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || friendlyStatusMessages[response.status] || 'No pudimos completar la operación.';
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data?.data !== undefined ? data.data : data;
};

export const apiUrl = API_URL;
