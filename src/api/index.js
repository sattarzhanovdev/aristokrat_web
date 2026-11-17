import { api, toApiError } from "./client";

export { api, API_BASE, ApiError, toApiError } from "./client";

/* ================== AUTH ================== */

/**
 * Логин. Бэкенд не выдаёт токенов — только данные пользователя,
 * поэтому сессия = сохранённые логин/пароль + кэш пользователя.
 */
export async function loginRequest(login, password) {
  try {
    const { data } = await api.post("/api/auth/login/", { login, password });
    return data?.user || data;
  } catch (e) {
    throw toApiError(e, "Не удалось войти");
  }
}

/* ================== APARTMENTS (admin) ================== */

export async function getApartments({ entrance, search, url } = {}) {
  try {
    if (url) {
      const { data } = await api.get(url);
      return normalizePage(data);
    }
    const params = {};
    if (entrance && entrance !== "all") params.entrance = entrance;
    if (search) params.search = search;
    const { data } = await api.get("/api/apartments/", { params });
    return normalizePage(data);
  } catch (e) {
    throw toApiError(e, "Не удалось загрузить квартиры");
  }
}

function normalizePage(data) {
  if (Array.isArray(data)) return { items: data, next: null, count: data.length };
  return {
    items: data?.results || [],
    next: data?.next || null,
    count: data?.count ?? (data?.results || []).length,
  };
}

export async function getApartment(id) {
  try {
    const { data } = await api.get(`/api/apartments/${id}/`);
    return data;
  } catch (e) {
    throw toApiError(e, "Не удалось загрузить квартиру");
  }
}

export async function setApartmentBlocked(id, blocked) {
  try {
    if (blocked) {
      await api.patch(`/api/apartments/${id}/block/`);
    } else {
      await api.patch(`/api/apartments/${id}/`, { is_blocked: false });
    }
    return getApartment(id);
  } catch (e) {
    throw toApiError(e, "Нет прав для этого действия");
  }
}

export async function setApartmentApproval(id, accept) {
  try {
    const { data } = await api.patch(
      `/api/apartments/${id}/${accept ? "accept" : "reject"}/`,
    );
    return data;
  } catch (e) {
    throw toApiError(e, "Не удалось обновить статус");
  }
}

export default api;
