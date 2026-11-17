import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { loginRequest } from "../api";
import {
  readSession,
  writeSession,
  updateCachedUser,
  clearSession,
  isApproved,
  isAdminUser,
} from "./session";

const AuthContext = createContext(null);

/** Как часто тихо проверять, что аккаунт всё ещё активен. */
const REVALIDATE_EVERY_MS = 5 * 60 * 1000;
/** Не чаще, чем раз в N мс при возврате в приложение. */
const REVALIDATE_THROTTLE_MS = 60 * 1000;

/**
 * Сессия больше НЕ сбрасывается из-за сети, таймаутов, ошибок сервера
 * или сворачивания приложения. Выходим только если сервер явно сказал,
 * что логин/пароль больше не подходят (401/403), или пользователь нажал «Выйти».
 */
export function AuthProvider({ children }) {
  const initial = useRef(readSession());
  const [user, setUser] = useState(initial.current?.user || null);
  const [signedIn, setSignedIn] = useState(!!initial.current);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine === false : false,
  );
  const [endedReason, setEndedReason] = useState("");
  const lastCheck = useRef(0);
  const inFlight = useRef(null);

  const signOut = useCallback((reason = "") => {
    clearSession();
    setUser(null);
    setSignedIn(false);
    setEndedReason(reason);
  }, []);

  const revalidate = useCallback(
    async ({ force = false } = {}) => {
      const s = readSession();
      if (!s) return;
      if (!force && Date.now() - lastCheck.current < REVALIDATE_THROTTLE_MS) return;
      if (inFlight.current) return inFlight.current;

      inFlight.current = (async () => {
        try {
          const fresh = await loginRequest(s.login, s.password);
          lastCheck.current = Date.now();
          updateCachedUser(fresh);
          setUser(fresh);
          setOffline(false);
          return fresh;
        } catch (e) {
          if (e.status === 401 || e.status === 403) {
            signOut("Пароль был изменён или доступ закрыт. Войдите снова.");
          } else {
            // сеть / сервер спит / таймаут — остаёмся в аккаунте
            setOffline(!!e.network);
          }
        } finally {
          inFlight.current = null;
        }
      })();
      return inFlight.current;
    },
    [signOut],
  );

  const signIn = useCallback(async ({ login, password, remember }) => {
    const fresh = await loginRequest(login.trim(), password);
    writeSession({ login: login.trim(), password, user: fresh, remember });
    lastCheck.current = Date.now();
    setEndedReason("");
    setUser(fresh);
    setSignedIn(true);
    setOffline(false);
    return fresh;
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    revalidate({ force: true });

    const onVisible = () => {
      if (document.visibilityState === "visible") revalidate();
    };
    const onOnline = () => {
      setOffline(false);
      revalidate({ force: true });
    };
    const onOffline = () => setOffline(true);
    const timer = setInterval(() => revalidate({ force: true }), REVALIDATE_EVERY_MS);

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [signedIn, revalidate]);

  const value = useMemo(
    () => ({
      user,
      signedIn,
      approved: isApproved(user),
      isAdmin: isAdminUser(user),
      offline,
      endedReason,
      signIn,
      signOut,
      revalidate,
    }),
    [user, signedIn, offline, endedReason, signIn, signOut, revalidate],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
