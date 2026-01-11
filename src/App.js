import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MainRoutes } from "./routes";
import { Components } from "./components";
import "./App.scss";

import {
  getMe,
  fetchJson,
  clearTokens,
} from "./api";

/* ================== UTILS ================== */

const PUBLIC_PATHS = new Set([
  "/login",
  "/forgot",
  "/reset",
]);

function isActiveResidentFlag(p) {
  if (!p || typeof p !== "object") return true;
  if ("is_active_resident" in p) return !!p.is_active_resident;
  if ("is_active" in p) return !!p.is_active;
  if ("active" in p) return !!p.active;
  return true;
}

/* ================== APP ================== */

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [ready, setReady] = React.useState(false);
  const mountedRef = React.useRef(true);
  const ranRef = React.useRef(false); // защита от StrictMode double-run

  React.useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /* ================== AUTH FLOW ================== */
  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    let canceled = false;

    (async () => {
      /* ---------- Public routes ---------- */
      if (PUBLIC_PATHS.has(pathname)) {
        if (!canceled && mountedRef.current) {
          setReady(true);
        }
        ranRef.current = false;
        return;
      }

      /* ---------- Token presence ---------- */
      const hasAnyToken =
        localStorage.getItem("access") ||
        localStorage.getItem("refresh");

      if (!hasAnyToken) {
        if (!canceled && mountedRef.current) {
          setReady(true);
          navigate("/login", { replace: true });
        }
        ranRef.current = false;
        return;
      }

      /* ---------- Render UI early ---------- */
      if (!canceled && mountedRef.current) {
        setReady(true);
      }

      /* ---------- /me (auto-refresh inside interceptor) ---------- */
      try {
        await getMe();
      } catch (e) {
        const status = e?.response?.status ?? e?.status;
        if (status === 401 || status === 403) {
          clearTokens();
          if (!canceled && mountedRef.current) {
            navigate("/login", { replace: true });
          }
          ranRef.current = false;
          return;
        }
        // другие ошибки не блокируют UI
      }

      /* ---------- profile activity check ---------- */
      try {
        const prof = await fetchJson("/api/profile/me/");
        if (!isActiveResidentFlag(prof)) {
          clearTokens();
          if (!canceled && mountedRef.current) {
            alert(
              "Ваш аккаунт или жильё заблокированы. Обратитесь к администратору."
            );
            navigate("/login", { replace: true });
          }
          ranRef.current = false;
          return;
        }
      } catch {
        // профиль недоступен — не валим приложение
      }

      ranRef.current = false;
    })();

    return () => {
      canceled = true;
      ranRef.current = false;
    };
  }, [pathname, navigate]);

  /* ================== RENDER ================== */

  if (!ready) {
    // лёгкий placeholder вместо белого экрана
    return <div style={{ height: "100vh" }} />;
  }

  return (
    <div>
      <Components.Navbar />
      <MainRoutes />
    </div>
  );
}
