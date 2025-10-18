// Main.jsx
import React, { useEffect, useState } from "react";
import c from "./main.module.scss";
import {
  getResidentEntranceNo,
  getIsAdmin,
  getPasswordStatus,
  changePassword,
  getApprovalStatus,
  fetchJson, // /api/auth/me и /api/profile/me
} from "../../api";
import logo from "../../images/logo.svg";

/* ================= Firebase RTDB Streaming (SSE) ================= */
const DB_URL =
  "https://aristokrat-aa238-default-rtdb.asia-southeast1.firebasedatabase.app";
const ID_TOKEN = null;
const authQ = ID_TOKEN ? `?auth=${encodeURIComponent(ID_TOKEN)}` : "";
const toUrl = (path) => `${DB_URL}${path}.json${authQ}`;

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
  if (typeof x === "string") {
    const s = x.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return false;
};

const subscribeStream = (path, onChange) => {
  const es = new EventSource(toUrl(path));
  const handler = (ev) => {
    try {
      const payload = JSON.parse(ev.data);
      onChange(payload);
    } catch (_) {}
  };
  es.addEventListener("put", handler);
  es.addEventListener("patch", handler);
  es.onerror = () => {};
  return () => es.close();
};

const startPolling = (path, onChange, interval = 2000) => {
  let timer;
  const tick = async () => {
    try {
      const res = await fetch(toUrl(path), { cache: "no-store" });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        onChange({ data, path: "/" });
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

/* =================== Формы =================== */
function PasswordChangeForm({ busy, error, onSubmit }) {
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [repeatPwd, setRepeatPwd] = useState("");

  return (
    <form
      className={c.pwdForm}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(oldPwd, newPwd, repeatPwd);
      }}
    >
      <label>
        Текущий пароль
        <input
          type="password"
          autoComplete="current-password"
          value={oldPwd}
          onChange={(e) => setOldPwd(e.target.value)}
          disabled={busy}
          required
        />
      </label>

      <label>
        Новый пароль
        <input
          type="password"
          autoComplete="new-password"
          value={newPwd}
          onChange={(e) => setNewPwd(e.target.value)}
          disabled={busy}
          required
          minLength={8}
        />
      </label>

      <label>
        Повторите новый пароль
        <input
          type="password"
          autoComplete="new-password"
          value={repeatPwd}
          onChange={(e) => setRepeatPwd(e.target.value)}
          disabled={busy}
          required
          minLength={8}
        />
      </label>

      {error && <div className={c.errorInline}>{error}</div>}

      <div className={c.modalActions}>
        <button type="submit" disabled={busy}>
          {busy ? "Сохраняем..." : "Сменить пароль"}
        </button>
      </div>
    </form>
  );
}

function ProfileUpdateForm({ busy, error, initial, onSubmit }) {
  const [firstName, setFirstName] = useState(initial?.firstName || "");
  const [phone, setPhone] = useState(initial?.phone || "");

  const normalizedPhone = (p) => p.replace(/[^\d+]/g, "");

  useEffect(() => {
    setFirstName(initial?.firstName || "");
    setPhone(initial?.phone || "");
  }, [initial]);

  return (
    <form
      className={c.pwdForm}
      onSubmit={(e) => {
        e.preventDefault();
        const fn = firstName.trim();
        const ph = normalizedPhone(phone).trim();
        onSubmit(fn, ph);
      }}
    >
      <label>
        Имя
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          disabled={busy}
          required
        />
      </label>

      <label>
        Телефон
        <input
          type="tel"
          inputMode="tel"
          placeholder="+996XXXXXXXXX"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={busy}
          required
        />
      </label>

      {error && <div className={c.errorInline}>{error}</div>}

      <div className={c.modalActions}>
        <button type="submit" disabled={busy}>
          {busy ? "Сохраняем..." : "Сохранить"}
        </button>
      </div>
    </form>
  );
}
/* ============================================ */

export default function Main() {
  const [entranceNo, setEntranceNo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // одобрен ли аккаунт
  const [isApproved, setIsApproved] = useState(true);

  // принудительная смена пароля
  const [mustChangePwd, setMustChangePwd] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdErr, setPwdErr] = useState("");

  // принудительное обновление профиля (имя + телефон)
  const [mustUpdateProfile, setMustUpdateProfile] = useState(false);
  const [profBusy, setProfBusy] = useState(false);
  const [profErr, setProfErr] = useState("");
  const [profileInitial, setProfileInitial] = useState({
    firstName: "",
    phone: "",
  });

  // локальные “импульсы” и временная блокировка
  const [active, setActive] = useState({});
  const [busy, setBusy] = useState({});
  const [remoteOn, setRemoteOn] = useState({});

  // роль + подъезд + статусы
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const [adminFlag, no, approval, pwd] = await Promise.all([
          getIsAdmin(),
          getResidentEntranceNo().catch(() => null),
          getApprovalStatus().catch(() => ({ status: "accepted" })), // фолбэк
          getPasswordStatus().catch(() => ({ status: "updated" })), // фолбэк
        ]);

        // 1) одобрение
        if (approval?.status !== "accepted") {
          setIsApproved(false);
          alert("Ваш аккаунт еще не одобрен");
          return;
        } else {
          setIsApproved(true);
        }

        setIsAdmin(adminFlag);
        setEntranceNo(no != null ? Number(no) : null);

        if (!adminFlag && !no) {
          setErr("В профиле нет номера подъезда. Обратитесь к администратору.");
        }

        // 2) пароль
        if (pwd?.status === "not_updated") {
          setMustChangePwd(true);
          return; // пароль первым делом
        }

        // 3) профиль (имя + телефон)
        await checkProfileNeed();
      } catch (e) {
        setErr(e?.message || "Не удалось получить данные профиля");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // после закрытия модалки пароля — проверяем профиль
  useEffect(() => {
    if (!mustChangePwd && isApproved) {
      checkProfileNeed().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mustChangePwd, isApproved]);

  // Проверка необходимости модалки профиля
  const checkProfileNeed = async () => {
    const [me, prof] = await Promise.all([
      fetchJson("/api/auth/me"),
      fetchJson("/api/profile/me").catch(() => ({})),
    ]);

    const firstName = String(me?.first_name || "").trim();
    const lastName = String(me?.last_name || "").trim();
    const userName = String(me?.username || "").trim();
    const profName = String(prof?.name || "").trim(); // если есть такое поле в профиле
    const phone = String(prof?.phone || me?.phone || "").trim();

    const phoneClean = phone.replace(/[^\d+]/g, "");
    const phoneValid =
      /^\+996\d{9}$/.test(phoneClean) || /^\+?\d{7,15}$/.test(phoneClean);

    // что подставить в инпут имени, если он пуст
    const initialName = firstName || lastName || profName || userName;
    setProfileInitial({ firstName: initialName, phone });

    // имя считаем "есть", если есть что-то из: first_name/last_name/prof.name/username
    const hasAnyName = Boolean(initialName);
    const need = !hasAnyName || !phoneValid;

    setMustUpdateProfile(need);
    return !need; // true = всё ок, модалка не нужна
  };

  const saveProfile = async (firstName, phone) => {
    setProfErr("");

    const phoneClean = phone.replace(/[^\d+]/g, "");
    if (!firstName) {
      setProfErr("Введите имя.");
      return;
    }
    if (!(/^\+996\d{9}$/.test(phoneClean) || /^\+?\d{7,15}$/.test(phoneClean))) {
      setProfErr("Введите корректный номер телефона.");
      return;
    }

    try {
      setProfBusy(true);
      // кладём введённое имя в first_name (можешь поменять на last_name или name)
      await fetchJson("/api/profile/me", {
        method: "PATCH",
        body: { first_name: firstName, phone: phoneClean },
      });

      // после сохранения повторно проверяем — если всё ок, закрываем модалку
      const ok = await checkProfileNeed();
      if (ok) setMustUpdateProfile(false);
    } catch (e) {
      setProfErr(e?.message || "Не удалось сохранить профиль");
    } finally {
      setProfBusy(false);
    }
  };

  /* ---------- STREAM: подписки на RTDB, без опросов ---------- */
  useEffect(() => {
    if (!isApproved) return;
    const onEntrancesChange = ({ data, path }) => {
      if (!data) return;

      const pushFlat = (obj) => {
        const upd = {};
        Object.keys(obj || {}).forEach((no) => {
          const e = obj[no] || {};
          upd[`door-${no}`] = toBool(e?.door?.value);
          upd[`liftPass-${no}`] = toBool(e?.lift_pass?.value);
          upd[`liftGruz-${no}`] = toBool(e?.lift_gruz?.value);
        });
        if (Object.keys(upd).length) {
          setRemoteOn((prev) => ({ ...prev, ...upd }));
        }
      };

      if (path === "/" || path === "" || path == null) {
        pushFlat(data);
        return;
      }

      const seg = String(path).split("/").filter(Boolean);
      if (seg.length >= 3) {
        const [no, which] = seg;
        const id =
          which === "door"
            ? `door-${no}`
            : which === "lift_pass"
            ? `liftPass-${no}`
            : which === "lift_gruz"
            ? `liftGruz-${no}`
            : null;
        if (id) {
          const v =
            typeof data === "object" && data !== null && "value" in data
              ? toBool(data.value)
              : toBool(data);
          setRemoteOn((prev) => ({ ...prev, [id]: v }));
        }
      } else if (seg.length === 1) {
        const no = seg[0];
        pushFlat({ [no]: data });
      }
    };

    let stop = subscribeStream("/entrances", onEntrancesChange);

    const safety = setTimeout(() => {
      const hasAnything = Object.keys(remoteOn).some(
        (k) =>
          k.startsWith("door-") ||
          k.startsWith("liftPass-") ||
          k.startsWith("liftGruz-")
      );
      if (!hasAnything) {
        stop?.();
        stop = startPolling("/entrances", onEntrancesChange, 2000);
      }
    }, 3000);

    return () => {
      clearTimeout(safety);
      stop?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApproved]);

  useEffect(() => {
    if (!isApproved) return;
    const stops = ["kalitka1", "kalitka2", "kalitka3", "kalitka4", "parking"].map(
      (name) =>
        subscribeStream(`/${name}`, ({ data }) => {
          const v =
            typeof data === "object" && data !== null && "value" in data
              ? toBool(data.value)
              : toBool(data);
          setRemoteOn((prev) => ({ ...prev, [keyId(name)]: v }));
        })
    );
    return () => stops.forEach((stop) => stop && stop());
  }, [isApproved]);

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

  const pulse = async (key, enNo = null) => {
    if (!isApproved) return;
    const targetEntrance = enNo ?? entranceNo;
    const needsEntrance =
      key === "door" || key === "liftPass" || key === "liftGruz";
    if (needsEntrance && !targetEntrance) return;

    const dbPath = pathFor(key, targetEntrance);
    if (!dbPath) return;

    const id = keyId(key, targetEntrance);
    if (busy[id] || remoteOn[id] === true) return;

    setBusy((s) => ({ ...s, [id]: true }));
    setActive((s) => ({ ...s, [id]: true }));

    try {
      await rtdbSetBoolean(dbPath, true);
    } catch {}

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
    return !!busy[id] || remoteOn[id] === true;
  };

  // Заблокированный UI при не-одобренном аккаунте
  if (!isApproved) {
    return (
      <div className={c.main}>
        <div className={c.logo}>
          <img src={logo} alt="logo" />
        </div>
        <div className={c.error}>
          Ваш аккаунт ещё не одобрен. Пожалуйста, дождитесь подтверждения администратора.
        </div>
      </div>
    );
  }

  return (
    <div className={c.main}>
      {/* Модалка смены пароля */}
      {mustChangePwd && (
        <div className={c.modalBackdrop}>
          <div className={c.modal}>
            <h3>Смена пароля</h3>
            <p className={c.modalDesc}>
              По требованиям безопасности вам нужно обновить пароль, чтобы продолжить.
            </p>
            <PasswordChangeForm
              busy={pwdBusy}
              error={pwdErr}
              onSubmit={async (oldPwd, newPwd, repeatPwd) => {
                setPwdErr("");
                if (!newPwd || newPwd.length < 8) {
                  setPwdErr("Новый пароль должен быть не короче 8 символов.");
                  return;
                }
                if (newPwd !== repeatPwd) {
                  setPwdErr("Пароли не совпадают.");
                  return;
                }
                try {
                  setPwdBusy(true);
                  await changePassword(oldPwd, newPwd);
                  setMustChangePwd(false);
                } catch (e) {
                  setPwdErr(e?.message || "Ошибка при смене пароля");
                } finally {
                  setPwdBusy(false);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Модалка обновления профиля (имя + телефон) */}
      {!mustChangePwd && mustUpdateProfile && (
        <div className={c.modalBackdrop}>
          <div className={c.modal}>
            <h3>Заполните профиль</h3>
            <p className={c.modalDesc}>
              Укажите имя и номер телефона, чтобы продолжить использование.
            </p>
            <ProfileUpdateForm
              busy={profBusy}
              error={profErr}
              initial={profileInitial}
              onSubmit={saveProfile}
            />
          </div>
        </div>
      )}

      <div className={c.logo}>
        <img src={logo} alt="logo" />
      </div>
      {err && <div className={c.error}>{err}</div>}

      {/* Админский UI */}
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
                    title={toBool(remoteOn[keyId("door", no)]) ? "Недоступно: value=true" : ""}
                  >
                    Дверь
                  </button>
                  <div className={c.row}>
                    <button
                      className={cls("liftPass", no)}
                      disabled={dis("liftPass", no)}
                      onClick={() => pulse("liftPass", no)}
                      title={toBool(remoteOn[keyId("liftPass", no)]) ? "Недоступно: value=true" : ""}
                    >
                      Лифт (пасс.)
                    </button>
                    <button
                      className={cls("liftGruz", no)}
                      disabled={dis("liftGruz", no)}
                      onClick={() => pulse("liftGruz", no)}
                      title={toBool(remoteOn[keyId("liftGruz", no)]) ? "Недоступно: value=true" : ""}
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

      {/* Пользовательский UI */}
      {!loading && !isAdmin && entranceNo && (
        <>
          <button
            className={cls("door", entranceNo)}
            disabled={dis("door", entranceNo)}
            onClick={() => pulse("door", entranceNo)}
            title={
              toBool(remoteOn[keyId("door", entranceNo)])
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
              title={toBool(remoteOn[keyId("liftPass", entranceNo)]) ? "Недоступно: value=true" : ""}
            >
              Лифт (пассажир)
            </button>
            <button
              className={cls("liftGruz", entranceNo)}
              disabled={dis("liftGruz", entranceNo)}
              onClick={() => pulse("liftGruz", entranceNo)}
              title={toBool(remoteOn[keyId("liftGruz", entranceNo)]) ? "Недоступно: value=true" : ""}
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
            {["kalitka1", "kalitka2", "kalitka3", "kalitka4"].map((k) => (
              <button
                key={k}
                className={cls(k)}
                disabled={dis(k)}
                onClick={() => pulse(k)}
                title={toBool(remoteOn[keyId(k)]) ? "Недоступно: value=true" : ""}
              >
                {k === "kalitka1"
                  ? "Калитка №1"
                  : k === "kalitka2"
                  ? "Калитка №2"
                  : k === "kalitka3"
                  ? "Калитка №3"
                  : "Калитка №4"}
              </button>
            ))}
          </div>

          <button
            className={cls("parking")}
            disabled={dis("parking")}
            onClick={() => pulse("parking")}
            title={toBool(remoteOn[keyId("parking")]) ? "Недоступно: value=true" : ""}
          >
            Паркинг
          </button>
        </>
      )}
    </div>
  );
}
