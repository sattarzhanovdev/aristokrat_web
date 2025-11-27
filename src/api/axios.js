// src/api/axios.js
import axios from 'axios';

const BASE_URL = 'https://aristokratamanat.pythonanywhere.com';

// Инстанс для обычных запросов
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // если refresh в httpOnly cookie или ещё нужен cookie контекст
});

// Отдельный "голый" клиент без интерсепторов — только для refresh
const authClient = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// ============ Хранилище токенов ============
const getAccess = () =>
  localStorage.getItem('accessToken') ||
  sessionStorage.getItem('accessToken') ||
  '';

const getRefresh = () =>
  localStorage.getItem('refreshToken') ||
  sessionStorage.getItem('refreshToken') ||
  '';

const setTokens = ({ accessToken, refreshToken }) => {
  // Определяем, где хранится refresh — там же держим и access, чтобы не было "скрещивания"
  const useLocal = !!localStorage.getItem('refreshToken');

  // Если refresh раньше лежал в sessionStorage — продолжаем там же
  const useSession = !!sessionStorage.getItem('refreshToken');

  // если свежий refreshToken пришёл — обновим расположение (приоритет: где уже лежит)
  if (refreshToken) {
    // очистим в обоих, чтобы не было дублей
    localStorage.removeItem('refreshToken');
    sessionStorage.removeItem('refreshToken');

    if (useLocal) localStorage.setItem('refreshToken', refreshToken);
    else if (useSession) sessionStorage.setItem('refreshToken', refreshToken);
    else localStorage.setItem('refreshToken', refreshToken); // дефолт — local
  }

  if (accessToken) {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');

    if (localStorage.getItem('refreshToken')) {
      localStorage.setItem('accessToken', accessToken);
    } else if (sessionStorage.getItem('refreshToken')) {
      sessionStorage.setItem('accessToken', accessToken);
    } else {
      // если нет refresh вообще — по умолчанию local
      localStorage.setItem('accessToken', accessToken);
    }
  }
};

const clearTokens = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
};

// ============ Проставляем access в каждый запрос ============
api.interceptors.request.use((config) => {
  const tok = getAccess();
  if (tok) config.headers.Authorization = `Bearer ${tok}`;
  return config;
});

// ============ Single-flight refresh очередь ============
let isRefreshing = false;
let subscribers = [];

/** Подписаться на результат refresh */
const subscribeTokenRefresh = (cb) => {
  subscribers.push(cb);
};

/** Уведомить всех ожидающих об новом accessToken */
const onRefreshed = (newAccessToken) => {
  subscribers.forEach((cb) => cb(newAccessToken));
  subscribers = [];
};

/** Выполнить рефреш токена (используем голый клиент) */
const performRefresh = async () => {
  const rt = getRefresh();
  if (!rt) throw new Error('No refresh token');

  // ПОДСТАВЬ под свой бекенд:
  // Тело запроса и имена полей ответа
  const { data } = await authClient.post('/api/auth/refresh', {
    refresh: rt,
    refreshToken: rt, // если бэку нужно так же
  }).catch(e => {
    if(e?.status === 401){
      window.location.reload()
    }
    
    
  })

  // ОЖИДАЕМ такие имена. Если у тебя { access } или { access: '...' } — поменяй:
  const newAccess = data?.accessToken || data?.access;
  const newRefresh = data?.refreshToken || data?.refresh;

  if (!newAccess) throw new Error('No access token in refresh response');

  setTokens({ accessToken: newAccess, refreshToken: newRefresh });
  return newAccess;
};

// ============ Интерсептор ответов с автоматическим повтором запроса ============
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const { response, config } = error || {};
    const status = response?.status;
    const original = config || {};

    // Если это не 401 или уже ретраили — пробрасываем
    if (status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Помечаем, чтобы не зациклить
    original._retry = true;

    // Если уже идёт refresh — ждём его
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh(async (newAccessToken) => {
          try {
            original.headers = {
              ...(original.headers || {}),
              Authorization: `Bearer ${newAccessToken}`,
            };
            const res = await api.request(original);
            resolve(res);
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    // Иначе — запускаем refresh
    isRefreshing = true;
    try {
      const newAccessToken = await performRefresh();

      // Разбудим очередь
      onRefreshed(newAccessToken);

      // Повторим изначальный запрос
      original.headers = {
        ...(original.headers || {}),
        Authorization: `Bearer ${newAccessToken}`,
      };
      return api.request(original);
    } catch (e) {
      // refresh не удался — чистим и пробрасываем ошибку
      clearTokens();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

// ============ Хелпер: тихий рефреш при старте приложения ============
/**
 * Попробовать освежить access при старте (если есть refresh).
 * Возвращает true/false — удалось или нет.
 */
const tryInitialRefresh = async () => {
  try {
    if (!getRefresh()) return false;
    await performRefresh();
    return true;
  } catch {
    return false;
  }
};

export { api, getAccess, setTokens, clearTokens, tryInitialRefresh };
