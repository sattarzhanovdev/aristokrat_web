// Main.jsx
import React, { useEffect, useRef, useState } from "react";
import c from "./main.module.scss";
import parkingBase from "./parking_list.json";
import logo from "../../images/logo.svg";

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

const toBool = (v) =>
  v === true || v === "true" || v === 1 || v === "1";

/* ================================================= */
export default function Main() {
  const [user, setUser] = useState(null);
  const [entranceNo, setEntranceNo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const [remoteOn, setRemoteOn] = useState({});
  const [busy, setBusy] = useState({});
  const [active, setActive] = useState({});

  const mounted = useRef(true);

  /* ================= LOGIN EVERY TIME ================= */
  useEffect(() => {
    mounted.current = true;

    (async () => {
      try {
        const login = localStorage.getItem("login");
        const password = localStorage.getItem("password");

        if (!login || !password) {
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
          window.location.href = "/login";
          return;
        }

        setUser(data);
        setIsAdmin(data.role === "admin");
        setEntranceNo(data.entrance_no ?? null);
      } catch (e) {
        window.location.href = "/login";
      } finally {
        mounted.current && setLoading(false);
      }
    })();

    return () => {
      mounted.current = false;
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

        mounted.current &&
          setRemoteOn((prev) => ({ ...prev, ...next }));
      } catch {}
    };

    es.onerror = () => es.close();
    return () => es.close();
  }, [loading, user]);

  /* ================= PARKING ================= */
  const apartment = user?.apartment_no ?? null;
  const apartmentNorm =
    apartment !== null ? String(apartment) : null;

  const isParkingHave = apartmentNorm
    ? parkingBase.some(
        (p) => String(p.apartment_number) === apartmentNorm
      )
    : false;

  /* ================= ACTION ================= */
  const pulse = async (key, path) => {
    if (busy[key] || remoteOn[key]) return;

    setBusy((s) => ({ ...s, [key]: true }));
    setActive((s) => ({ ...s, [key]: true }));

    try {
      await rtdbSetBoolean(path, true);
      setTimeout(() => rtdbSetBoolean(path, false), 1000);
    } finally {
      setTimeout(() => {
        setBusy((s) => ({ ...s, [key]: false }));
        setActive((s) => ({ ...s, [key]: false }));
      }, 1200);
    }
  };

  const cls = (key) => (active[key] ? c.active : "");

  if (loading) return null;

  /* ================= UI (ВЕРСТКА БЕЗ ИЗМЕНЕНИЙ) ================= */
  return (
    <div className={c.main}>
      <div className={c.logo}>
        <img src={logo} alt="logo" />
      </div>

      {isAdmin && (
        <>
          <h3 className={c.section}>Подъезды (админ)</h3>
          <div className={c.grid}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((no) => (
              <div key={no} className={c.entranceCard}>
                <div className={c.entranceTitle}>Подъезд №{no}</div>
                <div className={c.entranceButtons}>
                  <button
                    className={cls(`door-${no}`)}
                    onClick={() =>
                      pulse(`door-${no}`, `/entrances/${no}/door/value`)
                    }
                  >
                    Дверь
                  </button>
                  <div className={c.row}>
                    <button
                      className={cls(`liftPass-${no}`)}
                      onClick={() =>
                        pulse(
                          `liftPass-${no}`,
                          `/entrances/${no}/lift_pass/value`
                        )
                      }
                    >
                      Лифт (пасс.)
                    </button>
                    <button
                      className={cls(`liftGruz-${no}`)}
                      onClick={() =>
                        pulse(
                          `liftGruz-${no}`,
                          `/entrances/${no}/lift_gruz/value`
                        )
                      }
                    >
                      Лифт (груз.)
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!isAdmin && entranceNo && apartment !== "10000" && (
        <>
          <button
            className={cls(`door-${entranceNo}`)}
            onClick={() =>
              pulse(
                `door-${entranceNo}`,
                `/entrances/${entranceNo}/door/value`
              )
            }
          >
            Подъезд №{entranceNo}
          </button>

          <div className={c.elevators}>
            <button
              className={cls(`liftPass-${entranceNo}`)}
              onClick={() =>
                pulse(
                  `liftPass-${entranceNo}`,
                  `/entrances/${entranceNo}/lift_pass/value`
                )
              }
            >
              Лифт (пассажир)
            </button>

            <button
              className={cls(`liftGruz-${entranceNo}`)}
              onClick={() =>
                pulse(
                  `liftGruz-${entranceNo}`,
                  `/entrances/${entranceNo}/lift_gruz/value`
                )
              }
            >
              Лифт (грузовой)
            </button>
          </div>
        </>
      )}


      {apartment !== "10000" && (
        <div className={c.doors}>
          {[1, 2, 3, 4].map((n) => (
            <button
              key={n}
              className={cls(`kalitka${n}`)}
              onClick={() =>
                pulse(`kalitka${n}`, `/kalitka${n}/value`)
              }
            >
              Калитка №{n}
            </button>
          ))}
        </div>
      )}

      {(isAdmin || isParkingHave) && (
        <>
          <button
            className={cls("shlagbaum")}
            onClick={() =>
              pulse("shlagbaum", "/vorota1/shlagbaum")
            }
          >
            Шлагбаум
          </button>

          <button
            className={cls("parking1")}
            onClick={() =>
              pulse("parking1", "/vorota1/value")
            }
          >
            Паркинг1
          </button>

          <button
            className={cls("parking2")}
            onClick={() =>
              pulse("parking2", "/vorota2/value")
            }
          >
            Паркинг2
          </button>
        </>
      )}
    </div>
  );
}
