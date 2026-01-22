import axios from "axios";

/* ================== CONFIG ================== */
export const API_BASE = "http://127.0.0.1:8000";

/* ================== STORAGE ================== */
export const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  localStorage.setItem("user", JSON.stringify(user));
};

export const clearUser = () => {
  localStorage.removeItem("user");
};

/* ================== AXIOS INSTANCE ================== */
const api = axios.create({
  baseURL: API_BASE,
});

/*
  ❗️ ВАЖНО
  Никаких interceptors:
  - нет токенов
  - нет refresh
  - нет Authorization
*/

/* ================== HELPERS ================== */
export const fetchJson = async (url, options = {}) => {
  const res = await api({
    url,
    method: options.method || "GET",
    data: options.body,
  });
  return res.data;
};

/* ================== AUTH ================== */
export const login = async (login, password) => {
  const { data } = await api.post("/api/auth/login/", {
    login,
    password,
  });

  setUser(data);
  return data;
};

export const logout = () => {
  clearUser();
  window.location.href = "/login";
};

/* ================== USER ================== */
export const getMe = async () => {
  const user = getUser();
  if (!user) throw new Error("NOT_AUTHENTICATED");
  return user;
};


export const isAdmin = () => {
  const user = getUser();
  return user?.role === "admin";
};

export const isApproved = () => {
  const user = getUser();
  return user?.approval_status === "accepted";
};

/* ================== DATA ================== */
export const getApartments = async (params = {}) => {
  const { data } = await api.get("/api/apartments/", { params });
  return data;
};

export const getHouses = async () => {
  const { data } = await api.get("/api/houses/");
  return data;
};

export const getEntrances = async (house) => {
  const { data } = await api.get("/api/entrances/", {
    params: { house },
  });
  return data;
};

/* ================== DEVICES ================== */
export const getEntranceDeviceState = async (entranceNo, kind) => {
  const { data } = await api.get(
    `/api/entrances/${entranceNo}/${kind}/`
  );
  return data;
};

export const setEntranceDeviceState = async (entranceNo, kind, state) => {
  const { data } = await api.post(
    `/api/entrances/${entranceNo}/${kind}/`,
    { state }
  );
  return data;
};

export const getGlobalDeviceState = async (kind) => {
  const { data } = await api.get(`/api/${kind}/`);
  return data;
};

export const setGlobalDeviceState = async (kind, state) => {
  const { data } = await api.post(`/api/${kind}/`, { state });
  return data;
};

/* ================== DEFAULT EXPORT ================== */
export default api;
