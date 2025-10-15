// src/api/index.js
import { api } from './axios';

export const fetchJson = async (url, options = {}) => {
  const cfg = {
    method: options.method || 'GET',
    url, // относительный путь типа '/api/auth/me/'
    data: options.body ? JSON.parse(options.body) : options.data,
    headers: options.headers,
  };
  const { data } = await api(cfg);
  return data;
};

// Тихий рефреш access токена
export async function tryRefreshAccessToken() {
  try {
    const rt =
      localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');

    const payload = rt
      ? { refresh: rt, refreshToken: rt } // Шлём ОБА ключа
      : {};                               // если рассчитываешь на cookie

    const res = await fetch('https://aristokratamanat.pythonanywhere.com/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!res.ok) return false;

    const data = await res.json().catch(() => ({}));
    if (data?.accessToken) {
      if (localStorage.getItem('refreshToken'))
        localStorage.setItem('accessToken', data.accessToken);
      else
        sessionStorage.setItem('accessToken', data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// ВАЖНО: со слэшем на конце!
export const getMe = () => fetchJson('/api/auth/me');
export const getResidentProfileMe = () => fetchJson('/api/profile/me');

export const getIsAdmin = async () => {
  const me = await getMe();
  return Boolean(me.is_superuser || me.is_staff);
};

export const getResidentEntranceNo = async () => {
  const prof = await getResidentProfileMe().catch(() => null);
  return prof?.entrance_no ?? prof?.entrance ?? null;
};
