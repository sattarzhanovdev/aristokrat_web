/**
 * Хранилище сессии.
 *
 * Всё лежит в ОДНОМ хранилище: localStorage, если «Запомнить меня»,
 * иначе sessionStorage. Раньше пользователь мог сохраниться в sessionStorage,
 * а проверялся только localStorage — отсюда мгновенные «вылеты».
 */
const KEYS = ["user", "login", "password"];
const LEGACY_KEYS = ["accessToken", "refreshToken", "access_token"];

function safe(fn, fallback = null) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function activeStore() {
  if (safe(() => localStorage.getItem("login"))) return localStorage;
  if (safe(() => sessionStorage.getItem("login"))) return sessionStorage;
  return null;
}

export function readSession() {
  const s = activeStore();
  if (!s) return null;
  const login = safe(() => s.getItem("login"));
  const password = safe(() => s.getItem("password"));
  const user = safe(() => JSON.parse(s.getItem("user")));
  if (!login || !password) return null;
  return { login, password, user: user || null };
}

export function writeSession({ login, password, user, remember }) {
  clearSession();
  const s = remember ? localStorage : sessionStorage;
  safe(() => {
    s.setItem("login", login);
    s.setItem("password", password);
    s.setItem("user", JSON.stringify(user));
  });
}

export function updateCachedUser(user) {
  const s = activeStore();
  if (s) safe(() => s.setItem("user", JSON.stringify(user)));
}

export function clearSession() {
  [localStorage, sessionStorage].forEach((s) =>
    [...KEYS, ...LEGACY_KEYS].forEach((k) => safe(() => s.removeItem(k))),
  );
}

export const isApproved = (u) => u?.approval_status === "accepted";
export const isAdminUser = (u) => u?.role === "admin";
