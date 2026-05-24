import axios from 'axios';

// In production the env var VITE_API_URL points to the Render backend.
// In local dev it falls back to '/api' which Vite proxies to localhost:5000.
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

// Attach token from module-level ref (set by AuthContext)
let _getToken = () => null;

export function setTokenGetter(fn) {
  _getToken = fn;
}

api.interceptors.request.use((config) => {
  const token = _getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      window.dispatchEvent(new Event('auth:logout'));
    }
    return Promise.reject(err);
  }
);

export default api;
