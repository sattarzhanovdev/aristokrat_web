import React, { useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LuEye, LuEyeOff, LuCircleAlert, LuUser, LuKeyRound } from "react-icons/lu";
import { useAuth } from "../../auth/AuthProvider";
import { haptic } from "../../lib/native";
import logo from "../../images/logo.svg";
import ui from "../../components/ui/ui.module.scss";
import c from "./login.module.scss";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, endedReason } = useAuth();
  const passRef = useRef(null);

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(endedReason || "");

  const canSubmit = login.trim() && password && !loading;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      await signIn({ login, password, remember });
      haptic.success();
      const to = location.state?.from?.pathname || "/";
      navigate(to, { replace: true });
    } catch (err) {
      haptic.error();
      setError(
        err.status === 401 || err.status === 400
          ? "Неверный логин или пароль"
          : err.message || "Не удалось войти. Попробуйте ещё раз",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={c.page}>
      <div className={c.hero}>
        <div className={c.logo}>
          <img src={logo} alt="Аристократ" />
        </div>
        <h1>Добро пожаловать</h1>
        <p>Войдите, чтобы открывать шлагбаум и ворота паркинга</p>
      </div>

      <form className={c.card} onSubmit={onSubmit} noValidate>
        <label className={c.field}>
          <LuUser className={c.fieldIcon} />
          <input
            type="text"
            inputMode="text"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            placeholder="Логин"
            aria-label="Логин"
            value={login}
            onChange={(e) => {
              setLogin(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                passRef.current?.focus();
              }
            }}
          />
        </label>

        <label className={c.field}>
          <LuKeyRound className={c.fieldIcon} />
          <input
            ref={passRef}
            type={showPass ? "text" : "password"}
            autoComplete="current-password"
            enterKeyHint="go"
            placeholder="Пароль"
            aria-label="Пароль"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
          <button
            type="button"
            className={c.eye}
            onClick={() => setShowPass((s) => !s)}
            aria-label={showPass ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPass ? <LuEyeOff /> : <LuEye />}
          </button>
        </label>

        <label className={c.remember}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span className={c.switch} aria-hidden />
          Оставаться в аккаунте
        </label>

        {error && (
          <div className={c.error} role="alert">
            <LuCircleAlert />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className={`${ui.btn} ${ui.btnPrimary}`} disabled={!canSubmit}>
          {loading ? <span className={ui.spinner} /> : "Войти"}
        </button>
      </form>

      <p className={c.foot}>Нет доступа? Обратитесь к администратору ЖК</p>
    </div>
  );
}
