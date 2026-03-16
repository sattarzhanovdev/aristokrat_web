import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import c from "./login.module.scss";

const API = "https://aristokratamanat.pythonanywhere.com";

// --- helpers ---
async function postJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const msg =
      typeof data === "object" && data?.message
        ? data.message
        : data || res.statusText;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

export default function Login() {
  const navigate = useNavigate();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = login.trim() && password.trim();
  const storage = remember ? localStorage : sessionStorage;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError("");

    try {
      // === LOGIN ===
      const data = await postJson(`${API}/api/auth/login/`, {
        login,
        password,
      });

      const user = data.user || data;

      // === ПРОВЕРКИ ===
      if (user.approval_status === "not_accepted") {
        throw new Error("Ваш профиль ещё не подтверждён администратором");
      }

      // === СОХРАНЯЕМ ДАННЫЕ ДЛЯ ПОВТОРНОГО ЛОГИНА ===
      storage.setItem("login", login);
      storage.setItem("password", password);

      // === СОХРАНЯЕМ ТОКЕНЫ ЕСЛИ ЕСТЬ ===
      if (data.accessToken) {
        storage.setItem("accessToken", data.accessToken);
      }
      if (data.refreshToken) {
        storage.setItem("refreshToken", data.refreshToken);
      }

      // === СОХРАНЯЕМ ПОЛЬЗОВАТЕЛЯ ===
      storage.setItem("user", JSON.stringify(user));

      navigate("/", { replace: true });
    } catch (err) {
      if (err.status === 400 || err.status === 401) {
        setError(err.message || "Неверный логин или пароль");
      } else {
        setError(err.message || "Не удалось войти. Попробуйте ещё раз.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={c.loginPage}>
      <div className={c.card}>
        <div className={c.header}>
          <h1>Вход</h1>
          <p>Введите логин и пароль</p>
        </div>

        <form className={c.form} onSubmit={onSubmit} noValidate>
          <label className={c.label}>
            Логин
            <input
              className={c.input}
              type="text"
              placeholder="001"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
            />
          </label>

          <label className={c.label}>
            Пароль
            <div className={c.passWrap}>
              <input
                className={c.input}
                type={showPass ? "text" : "password"}
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className={c.eye}
                onClick={() => setShowPass((s) => !s)}
              >
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>
          </label>

          <div className={c.row}>
            <label className={c.checkbox}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Запомнить меня
            </label>
          </div>

          {error && <div className={c.errorBox}>{error}</div>}

          <button type="submit" className={c.submit} disabled={!canSubmit}>
            {loading ? "Входим…" : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}
