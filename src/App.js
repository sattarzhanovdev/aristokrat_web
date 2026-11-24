import React from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import "./App.scss";

import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { ToastProvider } from "./components/ui/Toast";
import AppLayout from "./components/layout/AppLayout";
import Login from "./screens/login";
import Pending from "./screens/pending";
import Main from "./screens/main";
import Profile from "./screens/profile";
import Bills, { Blocked } from "./screens/bills";
import AdminApp from "./admin/AdminApp";

function RequireAuth({ children }) {
  const { signedIn, approved, blocked } = useAuth();
  const location = useLocation();
  if (!signedIn) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!approved) return <Pending />;
  // неуплата по счёту с галочкой «Блокировать»: только счета к оплате
  if (blocked) return <Blocked />;
  return children;
}

function RequireAdmin({ children }) {
  const { isAdmin } = useAuth();
  return isAdmin ? children : <Navigate to="/" replace />;
}

function PublicOnly({ children }) {
  const { signedIn } = useAuth();
  return signedIn ? <Navigate to="/" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            path="/admin/*"
            element={
              <RequireAuth>
                <RequireAdmin>
                  <AdminApp />
                </RequireAdmin>
              </RequireAuth>
            }
          />
          <Route
            element={
              <RequireAuth>
                <AppLayout />
              </RequireAuth>
            }
          >
            <Route index element={<Main />} />
            <Route path="bills" element={<Bills />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  );
}
