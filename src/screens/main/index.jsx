// Main.jsx
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import c from "./main.module.scss";
import logo from "../../images/logo.svg";
import { LuDoorOpen, LuCheck } from "react-icons/lu";
import { MdElevator, MdLocalParking } from "react-icons/md";
import { TbFence, TbBarrierBlock } from "react-icons/tb";

import api from "../../api";

/* ================= Firebase ================= */
const DB_URL =
  "https://aristokrat-aa238-default-rtdb.asia-southeast1.firebasedatabase.app";

const toUrl = (path) => `${DB_URL}${path}.json`;

const rtdbSetBoolean = async (path, value) => {
  await fetch(toUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(!!value),
  });
};

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

const greetingByHour = () => {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
};

/* ================================================= */
export default function Main() {
  const mounted = useRef(false);
  const lastCheckedRef = useRef(0);
  const activeTimersRef = useRef({});
  const toastTimerRef = useRef(null);

  const [user, setUser] = useState(null);
  const [entranceNo, setEntranceNo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [remoteOn, setRemoteOn] = useState({});
  const [busy, setBusy] = useState({});
  const [active, setActive] = useState({});
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      if (mounted.current) setToast("");
    }, 1800);
  }, []);

  const flashActive = useCallback((key, ms = 1000) => {
    setActive((s) => ({ ...s, [key]: true }));

    const prevTimer = activeTimersRef.current[key];
    if (prevTimer) clearTimeout(prevTimer);

    activeTimersRef.current[key] = setTimeout(() => {
      if (!mounted.current) return;
      setActive((s) => ({ ...s, [key]: false }));
      delete activeTimersRef.current[key];
    }, ms);
  }, []);

  /* ================= LOGIN EVERY TIME ================= */
  useEffect(() => {
    mounted.current = true;

    const checkAuth = async () => {
      const now = Date.now();
      if (now - lastCheckedRef.current < 30000) return; // check every 30 sec

      try {
        const login =
          localStorage.getItem("login") || sessionStorage.getItem("login");
        const password =
          localStorage.getItem("password") || sessionStorage.getItem("password");

        if (!login || !password) {
          if (mounted.current) setLoading(false);
          window.location.href = "/login";
          return;
        }

        const { data } = await api.post("/api/auth/login/", {
          login,
          password,
        });

        if (!mounted.current) return;

        if (data.approval_status !== "accepted") {
          alert("Ваш аккаунт ещё не одобрен администратором");
          setLoading(false);
          window.location.href = "/login";
          return;
        }

        setUser(data);
        setIsAdmin(data.role === "admin");
        setEntranceNo(data.entrance_no ?? null);
        lastCheckedRef.current = now;
        setLoading(false);
      } catch (e) {
        if (mounted.current) setLoading(false);
        window.location.href = "/login";
      }
    };

    checkAuth();
    const intervalId = setInterval(checkAuth, 5000);

    return () => {
      mounted.current = false;
      Object.values(activeTimersRef.current).forEach((t) => clearTimeout(t));
      activeTimersRef.current = {};
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      clearInterval(intervalId);
    };
  }, []);

  /* ================= FIREBASE ================= */
  useEffect(() => {
    if (loading || !user) return;

    const es = new EventSource(toUrl("/"));

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) || {};
        const next = {};

        Object.entries(data.entrances || {}).forEach(([no, e]) => {
          next[`door-${no}`] = toBool(e?.door?.value);
          next[`liftPass-${no}`] = toBool(e?.lift_pass?.value);
          next[`liftGruz-${no}`] = toBool(e?.lift_gruz?.value);
        });

        [1, 2, 3, 4].forEach((n) => {
          if (data[`kalitka${n}`]?.value !== undefined) {
            next[`kalitka${n}`] = toBool(data[`kalitka${n}`].value);
          }
        });

        if (data.vorota1) {
          next.parking1 = toBool(data.vorota1.value);
          next.shlagbaum = toBool(data.vorota1.shlagbaum);
        }
        if (data.vorota2) {
          next.parking2 = toBool(data.vorota2.value);
        }

        mounted.current && setRemoteOn((prev) => ({ ...prev, ...next }));
      } catch {}
    };

    es.onerror = () => es.close();
    return () => es.close();
  }, [loading, user]);

  /* ================= PARKING ================= */
  const apartment = user?.apartment_no ?? null;
  const isParkingHave = !!user?.has_parking;

  /* ================= ACTION ================= */
  const pulse = useCallback(
    async (key, path) => {
      flashActive(key, 1000);
      if (busy[key] || remoteOn[key]) {
        showToast("Уже открыто");
        return;
      }

      showToast("Сигнал отправлен");
      setBusy((s) => ({ ...s, [key]: true }));

      try {
        await rtdbSetBoolean(path, true);
        setTimeout(() => rtdbSetBoolean(path, false), 1000);
      } finally {
        setTimeout(() => {
          setBusy((s) => ({ ...s, [key]: false }));
        }, 1200);
      }
    },
    [busy, remoteOn, flashActive, showToast],
  );

  /* ================= CONTROL RENDERER ================= */
  const renderControl = ({ icon, label, keyName, path, wide = false }) => {
    const isActive = !!active[keyName];
    const isLive = !!remoteOn[keyName];
    const cn = [
      wide ? c.wide : c.tile,
      isActive ? c.active : "",
      isLive ? c.live : "",
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        key={keyName}
        className={cn}
        onClick={() => pulse(keyName, path)}
        aria-pressed={isActive}
      >
        {isActive ? <LuCheck className={c.ic} /> : icon}
        <span className={c.lbl}>{label}</span>
        {isActive ? (
          <span className={c.badgeOpen}>Открыто</span>
        ) : isLive ? (
          <span className={c.badgeLive}>
            <span className={c.dot} />
            сейчас
          </span>
        ) : null}
      </button>
    );
  };

  if (loading) return null;

  const displayName = isAdmin ? "Администратор" : user?.name || "Житель";

  /* ================= UI ================= */
  return (
    <div className={c.main}>
      {/* Brand — logo now lives in the navbar */}
      {/* <div className={c.logo}>
        <img src={logo} alt="logo" />
      </div> */}

      {/* Greeting */}
      <div className={c.hello}>
        <div className={c.helloText}>
          <span className={c.helloGreet}>{greetingByHour()}</span>
          <strong className={c.helloName}>{displayName}</strong>
        </div>
        <div className={c.chips}>
          {entranceNo ? <span className={c.chip}>Подъезд {entranceNo}</span> : null}
          {apartment && apartment !== "10000" && (
            <span className={c.chip}>Кв. {apartment}</span>
          )}
          {isParkingHave && <span className={c.chip}>Паркинг</span>}
        </div>
      </div>

      {isAdmin && (
        <>
          <h3 className={c.section}>Подъезды · админ</h3>
          <div className={c.grid}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((no) => (
              <div key={no} className={c.entranceCard}>
                <div className={c.entranceTitle}>Подъезд №{no}</div>
                <div className={c.entranceButtons}>
                  {renderControl({
                    icon: <LuDoorOpen className={c.ic} />,
                    label: "Дверь",
                    keyName: `door-${no}`,
                    path: `/entrances/${no}/door/value`,
                    wide: true,
                  })}
                  <div className={c.row}>
                    {renderControl({
                      icon: <MdElevator className={c.ic} />,
                      label: "Лифт · пасс.",
                      keyName: `liftPass-${no}`,
                      path: `/entrances/${no}/lift_pass/value`,
                    })}
                    {renderControl({
                      icon: <MdElevator className={c.ic} />,
                      label: "Лифт · груз.",
                      keyName: `liftGruz-${no}`,
                      path: `/entrances/${no}/lift_gruz/value`,
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isAdmin && entranceNo && apartment !== "10000" && (
        <>
          <h3 className={c.section}>Вход</h3>
          {renderControl({
            icon: <LuDoorOpen className={c.ic} />,
            label: `Подъезд №${entranceNo}`,
            keyName: `door-${entranceNo}`,
            path: `/entrances/${entranceNo}/door/value`,
            wide: true,
          })}

          <h3 className={c.section}>Лифты</h3>
          <div className={c.pair}>
            {renderControl({
              icon: <MdElevator className={c.ic} />,
              label: "Пассажирский",
              keyName: `liftPass-${entranceNo}`,
              path: `/entrances/${entranceNo}/lift_pass/value`,
            })}
            {renderControl({
              icon: <MdElevator className={c.ic} />,
              label: "Грузовой",
              keyName: `liftGruz-${entranceNo}`,
              path: `/entrances/${entranceNo}/lift_gruz/value`,
            })}
          </div>
        </>
      )}

      {apartment !== "10000" && (
        <>
          <h3 className={c.section}>Калитки</h3>
          <div className={c.doors}>
            {[1, 2, 3, 4].map((n) =>
              renderControl({
                icon: <TbFence className={c.ic} />,
                label: `Калитка №${n}`,
                keyName: `kalitka${n}`,
                path: `/kalitka${n}/value`,
              }),
            )}
          </div>
        </>
      )}

      {(isAdmin || isParkingHave) && (
        <>
          <h3 className={c.section}>Паркинг</h3>
          {renderControl({
            icon: <TbBarrierBlock className={c.ic} />,
            label: "Шлагбаум",
            keyName: "shlagbaum",
            path: "/vorota1/shlagbaum",
            wide: true,
          })}

          <div className={c.pair}>
            {renderControl({
              icon: <MdLocalParking className={c.ic} />,
              label: "Паркинг 1",
              keyName: "parking1",
              path: "/vorota1/value",
            })}
            {renderControl({
              icon: <MdLocalParking className={c.ic} />,
              label: "Паркинг 2",
              keyName: "parking2",
              path: "/vorota2/value",
            })}
          </div>
        </>
      )}

      {/* Toast */}
      <div className={`${c.toast} ${toast ? c.toastShow : ""}`} role="status">
        <LuCheck className={c.toastIc} />
        {toast}
      </div>
    </div>
  );
}
