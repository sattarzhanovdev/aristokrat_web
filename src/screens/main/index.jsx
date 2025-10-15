// Main.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import c from "./main.module.scss";
import { getResidentEntranceNo, getIsAdmin } from "../../api";
import logo from "../../images/logo.svg";

/* ================= Firebase RTDB Streaming (SSE) ================= */
const DB_URL =
  "https://aristokrat-aa238-default-rtdb.asia-southeast1.firebasedatabase.app";
const ID_TOKEN = null; // если правила закрыты — положи сюда JWT
const authQ = ID_TOKEN ? `?auth=${encodeURIComponent(ID_TOKEN)}` : "";

// REST endpoints
const toUrl = (path) => `${DB_URL}${path}.json${authQ}`;

// обычная запись (импульс)
const rtdbSetBoolean = async (path, value) => {
  const res = await fetch(toUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(!!value),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`RTDB ${res.status}: ${text}`);
  }
};

const toBool = (x) => {
    if (x === true || x === false) return x;
    if (x === 1 || x === 0) return !!x;
    if (typeof x === 'string') {
      const s = x.trim().toLowerCase();
      if (s === 'true') return true;
      if (s === 'false') return false;
    }
    return false;
  };

// подписка на события put/patch по данному пути
const subscribeStream = (path, onChange) => {
  // EventSource не принимает заголовки, поэтому auth — в query (?auth=..)
  const es = new EventSource(toUrl(path));
  const handler = (ev) => {
    try {
      const payload = JSON.parse(ev.data); // { path, data } или { path, data: {..} }
      // payload.data может быть объектом, булем, null
      onChange(payload);
    } catch (_) {
      // ignore malformed chunks
    }
  };
  es.addEventListener("put", handler);
  es.addEventListener("patch", handler);
  es.onerror = () => {
    // браузер сам попытается переподключиться; можем логировать при желании
  };
  return () => es.close();
};
/* ================================================================= */

const startPolling = (path, onChange, interval = 2000) => {
  let timer;
  const tick = async () => {
    try {
      const res = await fetch(toUrl(path), { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        onChange({ data, path: '/' });
      }
    } finally {
      timer = setTimeout(tick, interval);
    }
  };
  tick();
  return () => clearTimeout(timer);
};

const pathFor = (key, entranceNo) => {
  switch (key) {
    case "door":
      return `/entrances/${entranceNo}/door/value`;
    case "liftPass":
      return `/entrances/${entranceNo}/lift_pass/value`;
    case "liftGruz":
      return `/entrances/${entranceNo}/lift_gruz/value`;
    case "kalitka1":
      return `/kalitka1/value`;
    case "kalitka2":
      return `/kalitka2/value`;
    case "kalitka3":
      return `/kalitka3/value`;
    case "kalitka4":
      return `/kalitka4/value`;
    case "parking":
      return `/parking/value`;
    default:
      return null;
  }
};

const keyId = (key, enNo = null) => `${key}-${enNo ?? "global"}`;

// преобразуем снэпшот entrances -> плоская карта {'door-1': true/false, ...}
const flattenEntrances = (dataObj) => {
  const out = {};
  if (!dataObj || typeof dataObj !== "object") return out;
  Object.keys(dataObj).forEach((no) => {
    const e = dataObj[no] || {};
    // допускаем разные варианты вложенности; берём только .value
    out[keyId("door", no)]     = toBool(e.door?.value);
    out[keyId("liftPass", no)] = toBool(e.lift_pass?.value);
    out[keyId("liftGruz", no)] = toBool(e.lift_gruz?.value);
  });
  return out;
};

export default function Main() {
  const [entranceNo, setEntranceNo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // локальные “импульсы” и временная блокировка
  const [active, setActive] = useState({});
  const [busy, setBusy] = useState({});

  // серверные статусы: если true — кнопку дизэйблим
  const [remoteOn, setRemoteOn] = useState({}); // { 'door-3': true, 'kalitka1-global': false, ... }

  // роль + подъезд
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [adminFlag, no] = await Promise.all([
          getIsAdmin(),
          getResidentEntranceNo().catch(() => null),
        ]);
        setIsAdmin(adminFlag);
        setEntranceNo(no != null ? Number(no) : null); // <-- число
        if (!adminFlag && !no) {
          setErr("В профиле нет номера подъезда. Обратитесь к администратору.");
        }
      } catch (e) {
        setErr(e?.message || "Не удалось получить данные профиля");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  
  /* ---------- STREAM: подписки на RTDB, без опросов ---------- */
  // 1) /entrances — общая для всех (и админа, и обычного)
useEffect(() => {
  // общий обработчик (и для SSE, и для polling)
  const onEntrancesChange = ({ data, path }) => {
    if (!data) return;

    // helper: нормализуем буль
    const toBool = (x) => {
      if (x === true || x === false) return x;
      if (x === 1 || x === 0) return !!x;
      if (typeof x === 'string') {
        const s = x.trim().toLowerCase();
        if (s === 'true') return true;
        if (s === 'false') return false;
      }
      return false;
    };

    // расплющить целый снэпшот подъездов
    const pushFlat = (obj) => {
      const upd = {};
      Object.keys(obj || {}).forEach((no) => {
        const e = obj[no] || {};
        upd[`door-${no}`]     = toBool(e?.door?.value);
        upd[`liftPass-${no}`] = toBool(e?.lift_pass?.value);
        upd[`liftGruz-${no}`] = toBool(e?.lift_gruz?.value);
      });
      if (Object.keys(upd).length) {
        setRemoteOn((prev) => ({ ...prev, ...upd }));
      }
    };

    // path может быть '/' (полный снимок) или '/<no>/...' (точечный апдейт)
    if (path === '/' || path === '' || path == null) {
      pushFlat(data);
      return;
    }

    const seg = String(path).split('/').filter(Boolean); // ['1','lift_pass','value'] или ['1']
    if (seg.length >= 3) {
      const [no, which] = seg;
      const id =
        which === 'door'
          ? `door-${no}`
          : which === 'lift_pass'
          ? `liftPass-${no}`
          : which === 'lift_gruz'
          ? `liftGruz-${no}`
          : null;
      if (id) {
        const v = toBool(typeof data === 'object' && data !== null && 'value' in data ? data.value : data);
        setRemoteOn((prev) => ({ ...prev, [id]: v }));
      }
    } else if (seg.length === 1) {
      // пришёл целиком один подъезд
      const no = seg[0];
      pushFlat({ [no]: data });
    }
  };

  // 1) пробуем SSE
  let stop = subscribeStream('/entrances', onEntrancesChange);

  // 2) через 3с проверяем — если по подъездам не пришло ни одного ключа, переходим на polling
  const safety = setTimeout(() => {
    const hasAnything = Object.keys(remoteOn).some(
      (k) => k.startsWith('door-') || k.startsWith('liftPass-') || k.startsWith('liftGruz-')
    );
    if (!hasAnything) {
      stop?.();
      stop = startPolling('/entrances', onEntrancesChange, 2000);
    }
  }, 3000);

  return () => {
    clearTimeout(safety);
    stop?.();
  };
  // remoteOn только для safety-проверки; если боишься лишних пересозданий — вынеси его в useRef
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);



  // 2) Глобальные узлы: калитки и паркинг — отдельные стримы
  useEffect(() => {
    const stops = ["kalitka1", "kalitka2", "kalitka3", "kalitka4", "parking"].map(
      (name) =>
        subscribeStream(`/${name}`, ({ data }) => {
          const v = toBool(typeof data === "object" && data !== null && "value" in data ? data.value : data);
          setRemoteOn((prev) => ({ ...prev, [keyId(name)]: v }));
        })
    );
    return () => stops.forEach((stop) => stop && stop());
  }, []);
  /* ------------------------------------------------------------- */

  // анти-залипание: когда сервер сказал false — снимаем локальный busy
  useEffect(() => {
    const next = { ...busy };
    let changed = false;
    for (const [id, v] of Object.entries(remoteOn)) {
      if (v === false && next[id]) {
        next[id] = false;
        changed = true;
      }
    }
    if (changed) setBusy(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteOn]);

  // отправка импульса: true -> 1s -> false
  const pulse = async (key, enNo = null) => {
    const targetEntrance = enNo ?? entranceNo;
    const needsEntrance =
      key === "door" || key === "liftPass" || key === "liftGruz";
    if (needsEntrance && !targetEntrance) return;

    const dbPath = pathFor(key, targetEntrance);
    if (!dbPath) return;

    const id = keyId(key, targetEntrance);
    if (busy[id] || remoteOn[id] === true) return; // сервер держит true — не жмём

    setBusy((s) => ({ ...s, [id]: true }));
    setActive((s) => ({ ...s, [id]: true }));

    try {
      await rtdbSetBoolean(dbPath, true);
    } catch {
      // можно показать тост
    }

    setTimeout(async () => {
      try {
        await rtdbSetBoolean(dbPath, false);
      } catch {}
      setActive((s) => ({ ...s, [id]: false }));
      setBusy((s) => ({ ...s, [id]: false }));
    }, 1000);
  };

  const cls = (key, enNo = null) => (active[keyId(key, enNo)] ? c.active : "");
  const dis = (key, enNo = null) => {
    const id = keyId(key, enNo);
    return !!busy[id] || remoteOn[id] === true; // уже ок: undefined/false → кнопка активна
  };

  return (
    <div className={c.main}>
      <div className={c.logo}>
        <img src={logo} alt="logo" />
      </div>
      {err && <div className={c.error}>{err}</div>}

      {/* Админ: все подъезды */}
      {!loading && isAdmin && (
        <>
          <h3 className={c.section}>Подъезды (админ)</h3>
          <div className={c.grid}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((no) => (
              <div key={no} className={c.entranceCard}>
                <div className={c.entranceTitle}>Подъезд №{no}</div>
                <div className={c.entranceButtons}>
                  <button
                    className={cls("door", no)}
                    disabled={dis("door", no)}
                    onClick={() => pulse("door", no)}
                    title={
                      remoteOn[keyId("door", no)]
                        ? "Недоступно: value=true"
                        : ""
                    }
                  >
                    Дверь
                  </button>
                  <button
                    className={cls("liftPass", no)}
                    disabled={dis("liftPass", no)}
                    onClick={() => pulse("liftPass", no)}
                    title={
                      remoteOn[keyId("liftPass", no)]
                        ? "Недоступно: value=true"
                        : ""
                    }
                  >
                    Лифт (пасс.)
                  </button>
                  <button
                    className={cls("liftGruz", no)}
                    disabled={dis("liftGruz", no)}
                    onClick={() => pulse("liftGruz", no)}
                    title={
                      remoteOn[keyId("liftGruz", no)]
                        ? "Недоступно: value=true"
                        : ""
                    }
                  >
                    Лифт (груз.)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Обычный пользователь: только свой подъезд */}
      {!loading && !isAdmin && entranceNo && (
        <>
          <button
            className={cls("door", entranceNo)}
            disabled={dis("door", entranceNo)}
            onClick={() => pulse("door", entranceNo)}
            title={
              remoteOn[keyId("door", entranceNo)]
                ? "Недоступно: value=true"
                : `Подъезд ${entranceNo}`
            }
          >
            Подъезд №{entranceNo}
          </button>

          <div className={c.elevators}>
            <button
              className={cls("liftPass", entranceNo)}
              disabled={dis("liftPass", entranceNo)}
              onClick={() => pulse("liftPass", entranceNo)}
              title={
                remoteOn[keyId("liftPass", entranceNo)]
                  ? "Недоступно: value=true"
                  : ""
              }
            >
              Лифт (пассажир)
            </button>
            <button
              className={cls("liftGruz", entranceNo)}
              disabled={dis("liftGruz", entranceNo)}
              onClick={() => pulse("liftGruz", entranceNo)}
              title={
                remoteOn[keyId("liftGruz", entranceNo)]
                  ? "Недоступно: value=true"
                  : ""
              }
            >
              Лифт (грузовой)
            </button>
          </div>
        </>
      )}

      {/* Глобальные */}
      {!loading && (
        <>
          <div className={c.doors}>
            <button
              className={cls("kalitka1")}
              disabled={dis("kalitka1")}
              onClick={() => pulse("kalitka1")}
              title={
                remoteOn[keyId("kalitka1")] ? "Недоступно: value=true" : ""
              }
            >
              Калитка №1
            </button>
            <button
              className={cls("kalitka2")}
              disabled={dis("kalitka2")}
              onClick={() => pulse("kalitka2")}
              title={
                remoteOn[keyId("kalitka2")] ? "Недоступно: value=true" : ""
              }
            >
              Калитка №2
            </button>
            <button
              className={cls("kalitka3")}
              disabled={dis("kalitka3")}
              onClick={() => pulse("kalitka3")}
              title={
                remoteOn[keyId("kalitka3")] ? "Недоступно: value=true" : ""
              }
            >
              Калитка №3
            </button>
            <button
              className={cls("kalitka4")}
              disabled={dis("kalitka4")}
              onClick={() => pulse("kalitka4")}
              title={
                remoteOn[keyId("kalitka4")] ? "Недоступно: value=true" : ""
              }
            >
              Калитка №4
            </button>
          </div>

          <button
            className={cls("parking")}
            disabled={dis("parking")}
            onClick={() => pulse("parking")}
            title={remoteOn[keyId("parking")] ? "Недоступно: value=true" : ""}
          >
            Паркинг
          </button>
        </>
      )}
    </div>
  );
}
