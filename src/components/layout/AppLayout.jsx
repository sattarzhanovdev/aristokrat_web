import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LuHouse, LuUser, LuShieldCheck, LuWifiOff, LuReceipt } from "react-icons/lu";
import { useAuth } from "../../auth/AuthProvider";
import { haptic } from "../../lib/native";
import logo from "../../images/logo.svg";
import c from "./layout.module.scss";

const TITLES = {
  "/": "Аристократ",
  "/profile": "Профиль",
  "/bills": "Счета",
};

export default function AppLayout() {
  const { isAdmin, offline, billing } = useAuth();
  const { pathname } = useLocation();
  const unpaid = billing?.open_count || 0;

  const tabs = [
    { to: "/", label: "Главная", icon: LuHouse, end: true },
    ...(isAdmin
      ? [{ to: "/admin", label: "Управление", icon: LuShieldCheck }]
      : [{ to: "/bills", label: "Счета", icon: LuReceipt, badge: unpaid }]),
    { to: "/profile", label: "Профиль", icon: LuUser },
  ];

  return (
    <div className={c.shell}>
      <header className={c.top}>
        <div className={c.topInner}>
          <span className={c.brand}>
            <img src={logo} alt="" />
          </span>
          <h1 className={c.title}>{TITLES[pathname] || "Аристократ"}</h1>
        </div>
        {offline && (
          <div className={c.offline} role="status">
            <LuWifiOff /> Нет сети — вы остаётесь в аккаунте
          </div>
        )}
      </header>

      <main className={`${c.content} ${offline ? c.contentOffline : ""}`}>
        <Outlet />
      </main>

      <nav className={c.tabs} aria-label="Навигация">
        {tabs.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            replace
            onClick={() => haptic.tap()}
            className={({ isActive }) => `${c.tab} ${isActive ? c.tabActive : ""}`}
          >
            <span className={c.tabIconWrap}>
              <Icon className={c.tabIcon} />
              {badge > 0 && <span className={c.badge}>{badge > 9 ? "9+" : badge}</span>}
            </span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
