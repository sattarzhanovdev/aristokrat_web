import axios from "axios";
import { readSession } from "../auth/session";

// REACT_APP_API_URL в .env.local — например, http://127.0.0.1:8000 для локального бэкенда
export const API_BASE = (
  process.env.REACT_APP_API_URL || "https://aristokratamanat.pythonanywhere.com"
).replace(/\/$/, "");

/**
 * Один HTTP-клиент на всё приложение.
 * В мобильном приложении запросы идут через нативный CapacitorHttp
 * (включён в capacitor.config.json), поэтому CORS бэкенда не мешает.
 */
export const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 20000,
});

// Токен (выдаётся при логине) — для счетов и админ-панели
api.interceptors.request.use((config) => {
  const token = readSession()?.user?.token;
  if (token && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Ошибка, которую можно показать пользователю как есть. */
export class ApiError extends Error {
  constructor(message, { status = 0, network = false } = {}) {
    super(message);
    this.status = status;
    this.network = network;
  }
}

/** Приводит ошибку axios к понятному ApiError. */
export function toApiError(e, fallback = "Что-то пошло не так") {
  if (e instanceof ApiError) return e;
  const res = e?.response;
  if (!res) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return new ApiError(
      offline ? "Нет подключения к интернету" : "Сервер не отвечает. Попробуйте ещё раз",
      { network: true },
    );
  }
  const d = res.data;
  const msg = (d && typeof d === "object" && firstMessage(d)) || fallback;
  return new ApiError(String(msg), { status: res.status });
}

/** Достаёт первое человеческое сообщение из ответа DRF ({message}, {detail}, {field: [..]}). */
function firstMessage(d) {
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return firstMessage(d[0]);
  if (d && typeof d === "object") {
    if (d.message) return firstMessage(d.message);
    if (d.detail) return firstMessage(d.detail);
    if (d.non_field_errors) return firstMessage(d.non_field_errors);
    const k = Object.keys(d)[0];
    return k ? firstMessage(d[k]) : "";
  }
  return "";
}
