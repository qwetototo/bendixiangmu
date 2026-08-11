import axios from 'axios';

const LOCAL_TOKEN_KEY = 'twintrack.auth.token';
const SESSION_TOKEN_KEY = 'twintrack.auth.sessionToken';

export const http = axios.create();

export function getAuthToken(): string {
  return sessionStorage.getItem(SESSION_TOKEN_KEY) || localStorage.getItem(LOCAL_TOKEN_KEY) || '';
}

export function persistAuthToken(token: string, remember: boolean) {
  clearAuthToken();
  (remember ? localStorage : sessionStorage).setItem(remember ? LOCAL_TOKEN_KEY : SESSION_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
}

function notifyUnauthorized() {
  window.dispatchEvent(new CustomEvent('twintrack:unauthorized'));
}

http.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) notifyUnauthorized();
    return Promise.reject(error);
  },
);

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(input, { ...init, headers });
  if (response.status === 401) notifyUnauthorized();
  return response;
}
