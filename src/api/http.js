import axios from "axios";

let isRefreshing = false;
let queue = [];

const processQueue = (error, token = null) => {
  queue.forEach((p) => {
    if (error) p.reject(error);
    else p.resolve(token);
  });
  queue = [];
};

const api = axios.create({
  baseURL: "/api",
  withCredentials: true, // для refresh cookie
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post("/api/auth/refresh", {}, { withCredentials: true });
        const newToken = res.data.access_token;

        localStorage.setItem("access_token", newToken);
        api.defaults.headers.Authorization = `Bearer ${newToken}`;

        processQueue(null, newToken);
        return api(original);
      } catch (e) {
        processQueue(e, null);
        localStorage.removeItem("access_token");
        window.location.href = "/login";
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
