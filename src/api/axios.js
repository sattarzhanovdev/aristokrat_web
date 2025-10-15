// src/api/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://aristokratamanat.pythonanywhere.com',
  withCredentials: true, // чтобы cookie с refresh ходила
});

// токены в localStorage
const getAccess = () => localStorage.getItem('accessToken') || '';
const setAccess = (t) => t && localStorage.setItem('accessToken', t);
const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken'); // если вдруг хранишь ещё и рефреш
};

// ── request: добавляем Authorization
api.interceptors.request.use((config) => {
  const tok = getAccess();
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  return config;
});

// ── response: на 401 пробуем освежить access и повторить запрос 1 раз
let isRefreshing = false;
let queued = [];

const processQueue = (error, token = null) => {
  queued.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queued = [];
};

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config || {};
    if (error?.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const rt = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
        if (!rt) throw new Error('no refresh');

        const { data } = await api.post('/api/auth/refresh', { refresh: rt, refreshToken: rt }, { withCredentials: true });
        const newAccess = data?.accessToken;
        if (!newAccess) throw new Error('no accessToken');

        // кладём туда же, где лежит рефреш
        if (localStorage.getItem('refreshToken')) localStorage.setItem('accessToken', newAccess);
        else sessionStorage.setItem('accessToken', newAccess);

        original.headers = {
          ...(original.headers || {}),
          Authorization: `Bearer ${newAccess}`,
        };
        return api(original);
      } catch (e) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);


export { api, getAccess, setAccess, clearTokens };
