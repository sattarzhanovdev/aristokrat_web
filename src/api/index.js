import axios from "axios";

/** ================== КОНФИГ ================== */
// export const API_BASE = "https://aristokratamanat.pythonanywhere.com"; // поменяй при необходимости, либо оставь как есть
// const REFRESH_URL = "https://aristokratamanat.pythonanywhere.com/api/auth/refresh"; // или твой реальный /api/token/refresh/

export const API_BASE = "https://aristokratamanat.pythonanywhere.com/"; // поменяй при необходимости, либо оставь как есть
const REFRESH_URL = "/api/auth/refresh"; // или твой реальный /api/token/refresh/


/** ====== совместимость с разными ключами в storage ====== */
function getAccess() {
  return (
    localStorage.getItem("access") ||
    sessionStorage.getItem("access") ||
    localStorage.getItem("accessToken") ||
    sessionStorage.getItem("accessToken")
  );
}
function getRefresh() {
  return (
    localStorage.getItem("refresh") ||
    sessionStorage.getItem("refresh") ||
    localStorage.getItem("refreshToken") ||
    sessionStorage.getItem("refreshToken")
  );
}
function setAccess(token) {
  localStorage.setItem("access", token);
  localStorage.setItem("accessToken", token); // legacy
}
function setRefresh(token) {
  localStorage.setItem("refresh", token);
  localStorage.setItem("refreshToken", token); // legacy
}
export function clearTokens() {
  ["access","refresh","accessToken","refreshToken"].forEach(k=>{
    localStorage.removeItem(k); sessionStorage.removeItem(k);
  });
}

/** DRF любит закрывающий слеш */
function ensureSlash(url) {
  if (!url) return "/";
  const q = url.indexOf("?");
  if (q === -1) return url.endsWith("/") ? url : url + "/";
  const p = url.slice(0, q), qs = url.slice(q);
  return url;
  // return (p.endsWith("/") ? p : p + "/") + qs;
}

/** ================== AXIOS ИНСТАНС ================== */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: false, // для JWT в заголовке куки не нужны
});

// auth header
api.interceptors.request.use((cfg) => {
  const t = getAccess();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

// refresh on 401
let refreshing = false;
let queue = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    if (
      error?.response?.status === 401 &&
      !original._retry &&
      !String(original.url || "").includes(REFRESH_URL)
    ) {
      original._retry = true;

      if (!refreshing) {
        refreshing = true;
        try {
          const r = getRefresh();
          if (!r) throw new Error("No refresh token");
          // прямым axios без baseURL, но с ensureSlash
          const { data } = await axios.post(ensureSlash(API_BASE + REFRESH_URL.replace(/^\//,"")), { refresh: r });
          if (!data?.access) throw new Error("Bad refresh response");
          setAccess(data.access);
          queue.forEach((resume) => resume(data.access));
          queue = [];
        } catch (e) {
          queue = [];
          refreshing = false;
          // можно редиректить на /login
          return Promise.reject(error);
        }
        refreshing = false;
      }

      return new Promise((resolve) => {
        queue.push((newAccess) => {
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newAccess}`;
          resolve(api(original));
        });
      });
    }

    return Promise.reject(error);
  }
);

/** ============ fetchJson (на тех же токенах) ============ */
export async function fetchJson(path, options = {}) {
  const url = ensureSlash(API_BASE + String(path).replace(/^\//, ""));
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  const t = getAccess();
  if (t) headers.Authorization = `Bearer ${t}`;

  const doFetch = async () => {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error(data?.detail || data?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.response = data;
      throw err;
    }
    return data;
  };

  try {
    return await doFetch();
  } catch (err) {
    // один ретрай с refresh
    if (err.status === 401 && !options._retry && !url.includes(REFRESH_URL)) {
      const r = getRefresh();
      if (!r) throw err;
      const { data } = await axios.post(ensureSlash(API_BASE + REFRESH_URL.replace(/^\//,"")), { refreshToken: r });
      const newAccess = data?.access || data?.accessToken;
      if (!newAccess) throw err;
      setAccess(newAccess);
      return await fetchJson(path, { ...options, _retry: true });
    }
    throw err;
  }
}

/** ====== публичные функции, которых ждёт твой код ====== */
// шимы под старые вызовы
export const tryRefreshAccessToken = async () => {
  const r = getRefresh();
  if (!r) return false;
  try {
    const { data } = await axios.post(ensureSlash(API_BASE + REFRESH_URL.replace(/^\//,"")), { refreshToken: r });
    const newAccess = data?.access || data?.accessToken;
    if (!newAccess) return false;
    setAccess(newAccess);
    return true;
  } catch { return false; }
};

export const getMe = async () => {
  const { data } = await api.get("/api/auth/me/");
  // если бэк возвращает ещё и refresh — сохраним (редко, но вдруг)
  if (data?.access) setAccess(data.access);
  if (data?.refresh) setRefresh(data.refresh);
  localStorage.setItem('user', JSON.stringify(data))
  return data;
};

export const getResidentProfileMe = async () => {
  const { data } = await api.get("/api/profile/me/");
  return data;
};

// новые методы
export const getApprovalStatus = async () => {
  const { data } = await api.get("/api/me/approval-status/");
  return data; // {status: "accepted" | "not_accepted"}
};

export const getPasswordStatus = async () => {
  const { data } = await api.get("/api/me/password-status/");
  return data; // {status: "updated" | "not_updated"}
};

export const changePassword = async (oldPassword, newPassword) => {
  const { data } = await api.post("/api/me/change-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data; // {status:"updated"}
};

// утилиты, если вдруг нужны где-то ещё
export const getIsAdmin = async () => {
  const { data } = await api.get("/api/auth/me/");
  return Boolean(
    data?.adminFlag ??
    data?.is_admin ??
    data?.is_staff ??
    data?.is_superuser
  );
};
export const getResidentEntranceNo = async () => {
  const { data } = await api.get("/api/profile/me/");
  return data?.entrance_no ?? null;
};

export default api;
