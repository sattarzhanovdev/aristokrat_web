import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { MainRoutes } from "./routes";
import { Components } from "./components";
import "./App.scss";

import { getUser, clearUser, isApproved } from "./api";

/* ================== UTILS ================== */

const PUBLIC_PATHS = new Set([
  "/login",
  "/forgot",
  "/reset",
]);

/* ================== APP ================== */

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [ready, setReady] = React.useState(false);
  const ranRef = React.useRef(false); // защита от StrictMode double-run

  React.useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    // ---------- Public routes ----------
    if (PUBLIC_PATHS.has(pathname)) {
      setReady(true);
      ranRef.current = false;
      return;
    }

    // ---------- User presence ----------
    const user = getUser();

    if (!user) {
      setReady(true);
      navigate("/login", { replace: true });
      ranRef.current = false;
      return;
    }

    // ---------- Approval check ----------
    if (!isApproved()) {
      clearUser();
      alert("Ваш аккаунт ещё не подтверждён администратором");
      navigate("/login", { replace: true });
      ranRef.current = false;
      return;
    }

    // ---------- OK ----------
    setReady(true);
    ranRef.current = false;
  }, [pathname, navigate]);

  /* ================== RENDER ================== */

  if (!ready) {
    return <div style={{ height: "100vh" }} />;
  }

  return (
    <div>
      <Components.Navbar />
      <MainRoutes />
    </div>
  );
}
