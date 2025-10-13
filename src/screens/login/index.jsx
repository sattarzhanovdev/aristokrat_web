import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import c from './login.module.scss';

async function loginRequest({ login, password }) {
  // ЗАМЕНИ url на свой
  const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // чтобы сервер мог выставить httpOnly cookie
    body: JSON.stringify({ login, password }),
  });

  // ожидаем формат { accessToken?: string, user?: {}, message?: string }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Ошибка авторизации');
  }
  return res.json();
}

const Login = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');        // email или телефон
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
  const isPhone = (v) => /^\+?\d{10,15}$/.test(v.replace(/\s|-/g, ''));
  const isValidLogin = isEmail(login) || isPhone(login);
  const isValidPassword = password.length >= 6;
  const isFormValid = isValidLogin && isValidPassword;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid || loading) return;
    setLoading(true);
    setError('');

    try {
      const data = await loginRequest({ login, password });

      // В идеале сервер кладёт refreshToken в httpOnly cookie.
      // Если он ещё отдаёт accessToken — можно временно хранить его:
      if (data.accessToken && remember) {
        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
      }

      // редирект куда нужно
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={c.loginPage}>
      <div className={c.card}>
        <div className={c.header}>
          <h1>Вход</h1>
          <p>Введите номер телефона и пароль, чтобы продолжить</p>
        </div>

        <form className={c.form} onSubmit={onSubmit} noValidate>
          <label className={c.label}>
            Номер телефона
            <input
              className={`${c.input} ${login && !isValidLogin ? c.error : ''}`}
              type="text"
              placeholder="+996555555555"
              value={login}
              onChange={(e) => setLogin(e.target.value.trim())}
              autoComplete="username"
            />
          </label>

          <label className={c.label}>
            Пароль
            <div className={c.passWrap}>
              <input
                className={`${c.input} ${password && !isValidPassword ? c.error : ''}`}
                type={showPass ? 'text' : 'password'}
                placeholder="Минимум 6 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className={c.eye}
                onClick={() => setShowPass((s) => !s)}
                aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPass ? '🙈' : '👁️'}
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

            {/* <button
              type="button"
              className={c.linkBtn}
              onClick={() => navigate('/forgot')}
            >
              Забыли пароль?
            </button> */}
          </div>

          {error && <div className={c.errorBox}>{error}</div>}

          <button
            type="submit"
            className={c.submit}
            disabled={!isFormValid || loading}
          >
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
