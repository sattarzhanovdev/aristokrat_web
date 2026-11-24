import { api, toApiError } from "./client";

const call = async (fn, fallback) => {
  try {
    const { data } = await fn();
    return data;
  } catch (e) {
    throw toApiError(e, fallback);
  }
};

/* ================== ЖИТЕЛЬ ================== */

export const getMyBilling = () => call(() => api.get("/api/billing/me/"), "Не удалось загрузить счета");

export const startPayment = (invoiceId, returnUrl) =>
  call(
    () => api.post(`/api/billing/invoices/${invoiceId}/pay/`, { return_url: returnUrl }),
    "Не удалось начать оплату",
  );

export const getMyPayment = (id) => call(() => api.get(`/api/billing/payments/${id}/`), "Не удалось проверить оплату");

/* ================== АДМИН ================== */

export const adminOverview = () => call(() => api.get("/api/admin/overview/"), "Не удалось загрузить сводку");

export const adminInvoices = (params = {}) =>
  call(() => api.get("/api/admin/invoices/", { params: clean(params) }), "Не удалось загрузить счета");

export const adminInvoice = (id) => call(() => api.get(`/api/admin/invoices/${id}/`), "Не удалось загрузить счёт");

export const adminCreateInvoices = (body) =>
  call(() => api.post("/api/admin/invoices/", body), "Не удалось выставить счёт");

export const adminUpdateInvoice = (id, body) =>
  call(() => api.patch(`/api/admin/invoices/${id}/`, body), "Не удалось сохранить счёт");

export const adminCancelInvoice = (id) =>
  call(() => api.post(`/api/admin/invoices/${id}/cancel/`), "Не удалось отменить счёт");

export const adminMarkPaid = (id, body) =>
  call(() => api.post(`/api/admin/invoices/${id}/mark-paid/`, body), "Не удалось отметить оплату");

export const adminBatches = (params = {}) =>
  call(() => api.get("/api/admin/batches/", { params: clean(params) }), "Не удалось загрузить выставления");

export const adminBatch = (batch) => call(() => api.get(`/api/admin/batches/${batch}/`), "Не удалось загрузить выставление");

export const adminExtendBatch = (batch, due_date) =>
  call(() => api.patch(`/api/admin/batches/${batch}/`, { due_date }), "Не удалось продлить срок");

export const adminCancelBatch = (batch) =>
  call(() => api.post(`/api/admin/batches/${batch}/cancel/`), "Не удалось отменить счета");

export const adminDeleteInvoice = (id) =>
  call(() => api.delete(`/api/admin/invoices/${id}/`), "Не удалось удалить счёт");

export const adminDeleteBatch = (batch) =>
  call(() => api.delete(`/api/admin/batches/${batch}/`), "Не удалось удалить выставление");

export const adminResidents = (params = {}) =>
  call(() => api.get("/api/admin/residents/", { params: clean(params) }), "Не удалось загрузить жителей");

export const adminResident = (id) => call(() => api.get(`/api/admin/residents/${id}/`), "Не удалось загрузить жителя");

export const adminUpdateResident = (id, body) =>
  call(() => api.patch(`/api/admin/residents/${id}/`, body), "Не удалось сохранить");

export const adminPayments = (params = {}) =>
  call(() => api.get("/api/admin/payments/", { params: clean(params) }), "Не удалось загрузить платежи");

export const adminSettings = () => call(() => api.get("/api/admin/settings/"), "Не удалось загрузить настройки");

export const adminTestPayments = () =>
  call(() => api.get("/api/admin/test-payments/"), "Не удалось проверить тестовые оплаты");

export const adminDeleteTestPayments = () =>
  call(() => api.delete("/api/admin/test-payments/"), "Не удалось удалить тестовые оплаты");

/** Загрузка следующей страницы по полному URL из поля next. */
export const getPage = (url) => call(() => api.get(url), "Не удалось загрузить");

function clean(params) {
  const out = {};
  Object.entries(params).forEach(([k, v]) => {
    if (v !== "" && v !== null && v !== undefined && v !== "all") out[k] = v;
  });
  return out;
}

/* ================== ФОРМАТ ================== */

const CURRENCY_LABEL = { KGS: "сом", KZT: "₸", RUB: "₽", USD: "$" };

export function money(value, currency = "KGS") {
  const n = Number(value || 0);
  const s = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(n);
  return `${s} ${CURRENCY_LABEL[currency] || currency}`;
}

export function fmtDate(iso, opts = {}) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: opts.year === false ? undefined : "numeric" });
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

const plural = (n, [one, few, many]) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
export const days = (n) => `${n} ${plural(n, ["день", "дня", "дней"])}`;
export const pluralize = plural;

/** Сколько дней до срока (отрицательное — просрочка). */
export function daysUntil(iso) {
  if (!iso) return 0;
  const due = new Date(`${iso}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due - now) / 86400000);
}

export function dueText(iso) {
  const d = daysUntil(iso);
  if (d < 0) return `просрочен на ${days(-d)}`;
  if (d === 0) return "срок сегодня";
  if (d === 1) return "срок завтра";
  return `через ${days(d)}`;
}

export const STATUS_LABEL = {
  issued: "Ожидает",
  overdue: "Просрочен",
  blocking: "Блокирует",
  paid: "Оплачен",
  cancelled: "Отменён",
};

export const METHOD_LABEL = { online: "Онлайн", cash: "Наличные", transfer: "Перевод" };

/** «Декабрь 2026» для текущего месяца */
export function currentPeriod(date = new Date()) {
  const m = date.toLocaleDateString("ru-RU", { month: "long" });
  return `${m[0].toUpperCase()}${m.slice(1)} ${date.getFullYear()}`;
}
