import axios from "axios";

/* ================== CONFIG ================== */
export const API_BASE = "https://aristokratamanat.pythonanywhere.com";
const REFRESH_URL = "/api/auth/refresh/";

/* ================== TOKEN STORAGE ================== */
const getAccess = () => localStorage.getItem("access");
const getRefresh = () => localStorage.getItem("refresh");

const setAccess = (t) => localStorage.setItem("access", t);
const setRefresh = (t) => localStorage.setItem("refresh", t);

export const clearTokens = () => {
  localStorage.removeItem("access");
  localStorage.removeItem("refresh");
};

/* ================== AXIOS INSTANCE ================== */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

let refreshing = false;
let queue = [];

api.interceptors.request.use((cfg) => {
  const t = getAccess();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (
      error.response?.status === 401 &&
      !original?._retry &&
      !String(original?.url || "").includes(REFRESH_URL)
    ) {
      original._retry = true;

      if (refreshing) {
        return new Promise((resolve) => {
          queue.push((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      refreshing = true;

      try {
        const refresh = getRefresh();
        if (!refresh) throw new Error("NO_REFRESH");

        const { data } = await axios.post(
          API_BASE + REFRESH_URL,
          { refresh }
        );

        if (!data?.access) throw new Error("BAD_REFRESH");

        setAccess(data.access);
        if (data.refresh) setRefresh(data.refresh);

        queue.forEach((cb) => cb(data.access));
        queue = [];

        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch (e) {
        clearTokens();
        window.location.href = "/login";
        return Promise.reject(e);
      } finally {
        refreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

/* ================== HELPERS ================== */
export const fetchJson = async (url, options = {}) => {
  const res = await api({
    url,
    method: options.method || "GET",
    data: options.body,
  });
  return res.data;
};

export const tryRefreshAccessToken = async () => {
  const refresh = getRefresh();
  if (!refresh) return false;

  try {
    const { data } = await axios.post(
      API_BASE + REFRESH_URL,
      { refresh }
    );
    if (!data?.access) return false;
    setAccess(data.access);
    if (data.refresh) setRefresh(data.refresh);
    return true;
  } catch {
    return false;
  }
};

/* ================== API METHODS ================== */
export const getMe = async () => {
  const { data } = await api.get("/api/auth/me/");
  if (data?.access) setAccess(data.access);
  if (data?.refresh) setRefresh(data.refresh);
  localStorage.setItem("user", JSON.stringify(data));
  return data;
};

export const getResidentProfileMe = async () => {
  const { data } = await api.get("/api/profile/me/");
  return data;
};

export const getApprovalStatus = async () => {
  const { data } = await api.get("/api/me/approval-status/");
  return data;
};

export const getPasswordStatus = async () => {
  const { data } = await api.get("/api/me/password-status/");
  return data;
};

export const changePassword = async (oldPassword, newPassword) => {
  const { data } = await api.post("/api/me/change-password/", {
    old_password: oldPassword,
    new_password: newPassword,
  });
  return data;
};

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

/* ================== DEFAULT EXPORT ================== */
export default api;
