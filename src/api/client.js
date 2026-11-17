import axios from "axios";

export const API_BASE = "https://aristokratamanat.pythonanywhere.com";

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
  const msg =
    (d && typeof d === "object" && (d.message || d.detail)) || fallback;
  return new ApiError(String(msg), { status: res.status });
}
