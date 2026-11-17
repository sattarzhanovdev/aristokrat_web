import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LuHouse, LuUser, LuShieldCheck, LuWifiOff } from "react-icons/lu";
import { useAuth } from "../../auth/AuthProvider";
import { haptic } from "../../lib/native";
import logo from "../../images/logo.svg";
import c from "./layout.module.scss";

const TITLES = {
  "/": "Аристократ",
  "/profile": "Профиль",
  "/admin": "Квартиры",
};

export default function AppLayout() {
  const { isAdmin, offline } = useAuth();
  const { pathname } = useLocation();

  const tabs = [
    { to: "/", label: "Главная", icon: LuHouse, end: true },
    ...(isAdmin ? [{ to: "/admin", label: "Квартиры", icon: LuShieldCheck }] : []),
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
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            replace
            onClick={() => haptic.tap()}
            className={({ isActive }) => `${c.tab} ${isActive ? c.tabActive : ""}`}
          >
            <Icon className={c.tabIcon} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
