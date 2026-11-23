import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  LuArrowLeft,
  LuBuilding2,
  LuChartColumn,
  LuCreditCard,
  LuPlus,
  LuReceipt,
  LuSettings,
  LuUsers,
} from "react-icons/lu";
import { adminOverview } from "../api/billing";
import { useAuth } from "../auth/AuthProvider";
import logo from "../images/logo.svg";
import { Avatar, cx } from "./kit";
import NewInvoice from "./NewInvoice";
import { InvoiceInspector, ResidentInspector } from "./inspectors";
import Overview from "./pages/Overview";
import Invoices from "./pages/Invoices";
import Residents from "./pages/Residents";
import Payments from "./pages/Payments";
import Settings from "./pages/Settings";
import Apartments from "../screens/admin";
import s from "./admin.module.scss";

const AdminCtx = createContext(null);
export const useAdmin = () => useContext(AdminCtx);

const NAV = [
  { to: "", label: "Обзор", icon: LuChartColumn, end: true },
  { to: "invoices", label: "Счета", icon: LuReceipt, count: (o) => o?.overdue_count, alert: true },
  { to: "residents", label: "Жители", icon: LuUsers, count: (o) => o?.blocked_residents, alert: true },
  { to: "payments", label: "Платежи", icon: LuCreditCard },
  { to: "apartments", label: "Квартиры", icon: LuBuilding2 },
];

const TITLES = {
  "": "Обзор",
  invoices: "Счета",
  residents: "Жители",
  payments: "Платежи",
  apartments: "Квартиры",
  settings: "Настройки",
};

export default function AdminApp() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const section = pathname.replace(/^\/admin\/?/, "").split("/")[0];

  // сводка нужна сайдбару (счётчики) и обзору; обновляется после любых изменений
  const [overview, setOverview] = useState(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    adminOverview().then(setOverview).catch(() => {});
  }, [version]);

  // единое окно «Новый счёт», открывается откуда угодно
  const [composer, setComposer] = useState(null);
  const openComposer = useCallback((preset = {}) => setComposer(preset), []);

  // инспекторы открываются через ?invoice=ID / ?resident=ID — работают ссылки и «назад»
  const [params, setParams] = useSearchParams();
  const invoiceId = Number(params.get("invoice")) || null;
  const residentId = Number(params.get("resident")) || null;
  const openInvoice = useCallback(
    (id) => setParams((p) => { const n = new URLSearchParams(p); n.delete("resident"); n.set("invoice", id); return n; }),
    [setParams],
  );
  const openResident = useCallback(
    (id) => setParams((p) => { const n = new URLSearchParams(p); n.delete("invoice"); n.set("resident", id); return n; }),
    [setParams],
  );
  const closeInspector = useCallback(
    () => setParams((p) => { const n = new URLSearchParams(p); n.delete("invoice"); n.delete("resident"); return n; }),
    [setParams],
  );

  const ctx = useMemo(
    () => ({ overview, refresh, version, openComposer, openInvoice, openResident, invoiceId, residentId }),
    [overview, refresh, version, openComposer, openInvoice, openResident, invoiceId, residentId],
  );

  const link = (to) => (to ? `/admin/${to}` : "/admin");

  return (
    <AdminCtx.Provider value={ctx}>
      <div className={s.root}>
        <div className={s.shell}>
          <aside className={s.sidebar}>
            <div className={s.brand}>
              <span className={s.brandMark}>
                <img src={logo} alt="" />
              </span>
              <span className={s.brandText}>
                <b>Аристократ</b>
                <span>Управление</span>
              </span>
            </div>

            <nav className={s.nav} aria-label="Разделы">
              {NAV.map(({ to, label, icon: Icon, end, count, alert }) => {
                const n = count?.(overview) || 0;
                return (
                  <NavLink
                    key={to}
                    to={link(to)}
                    end={end}
                    title={label}
                    className={({ isActive }) => cx(s.navItem, isActive && s.navItemActive)}
                  >
                    <Icon className={s.navIcon} />
                    <span className={s.navText}>{label}</span>
                    {n > 0 && <span className={cx(s.navCount, alert && s.navCountAlert)}>{n}</span>}
                  </NavLink>
                );
              })}
            </nav>

            <div className={s.navLabel}>Действия</div>
            <nav className={s.nav}>
              <button
                type="button"
                className={s.navItem}
                style={{ border: 0, background: "none", font: "inherit", cursor: "pointer", textAlign: "left" }}
                onClick={() => openComposer()}
                title="Выставить счёт"
              >
                <LuPlus className={s.navIcon} />
                <span className={s.navText}>Выставить счёт</span>
              </button>
            </nav>

            <div className={s.sidebarFoot}>
              <NavLink
                to="/admin/settings"
                title="Настройки"
                className={({ isActive }) => cx(s.navItem, isActive && s.navItemActive)}
              >
                <LuSettings className={s.navIcon} />
                <span className={s.navText}>Настройки</span>
              </NavLink>
              <NavLink to="/" className={s.navItem} title="В приложение">
                <LuArrowLeft className={s.navIcon} />
                <span className={s.navText}>В приложение</span>
              </NavLink>
              <div className={s.me}>
                <Avatar name={user?.name || "А"} />
                <div>
                  <b>{user?.name || "Администратор"}</b>
                  {user?.login}
                </div>
              </div>
            </div>
          </aside>

          <div className={s.main}>
            <header className={s.mobileTop}>
              <NavLink to="/" className={s.btn_plain} style={{ display: "flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
                <LuArrowLeft /> Приложение
              </NavLink>
              <span>{TITLES[section] || "Управление"}</span>
              <NavLink to="/admin/settings" aria-label="Настройки" className={s.btn_plain} style={{ display: "flex", fontSize: 20 }}>
                <LuSettings />
              </NavLink>
            </header>

            <Routes>
              <Route index element={<Overview />} />
              <Route path="invoices" element={<Invoices />} />
              <Route path="residents" element={<Residents />} />
              <Route path="payments" element={<Payments />} />
              <Route
                path="apartments"
                element={
                  <div className={s.page}>
                    <div className={s.toolbar}>
                      <h1 className={s.largeTitle}>Квартиры</h1>
                    </div>
                    <Apartments />
                  </div>
                }
              />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>

            <nav className={s.mobileTabs} aria-label="Разделы">
              {NAV.map(({ to, label, icon: Icon, end, count }) => {
                const n = count?.(overview) || 0;
                return (
                  <NavLink
                    key={to}
                    to={link(to)}
                    end={end}
                    className={({ isActive }) => cx(s.mTab, isActive && s.mTabActive)}
                  >
                    <Icon />
                    {n > 0 && <span className={s.mTabBadge}>{n > 99 ? "99+" : n}</span>}
                    {label}
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>

        <InvoiceInspector id={invoiceId} onClose={closeInspector} onOpenResident={openResident} />
        <ResidentInspector id={residentId} onClose={closeInspector} onOpenInvoice={openInvoice} />

        <NewInvoice
          open={!!composer}
          preset={composer}
          onClose={() => setComposer(null)}
          onCreated={(res) => {
            setComposer(null);
            refresh();
            // сразу показываем, что выставили: итоги и список счетов
            if (res?.batch && res.created > 0) navigate(`/admin/invoices?batch=${res.batch}`);
          }}
        />
      </div>
    </AdminCtx.Provider>
  );
}
