import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import c from './login.module.scss';

const API = 'https://aristokratamanat.pythonanywhere.com';

// --- helpers ---
async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // чтоб сервер мог выставить httpOnly cookie
    body: JSON.stringify(body),
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const msg = typeof data === 'object' && data?.message ? data.message : (data || res.statusText);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}
async function getJson(url) {
  const res = await fetch(url, { credentials: 'include' });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.message || res.statusText);
    err.status = res.status;
    throw err;
  }
  return data;
}

// --- validators ---
const isEmail = (v) => /\S+@\S+\.\S+/.test(v);
const isPhone = (v) => /^\+?\d{10,15}$/.test(v.replace(/\s|-/g, ''));
const isApt   = (v) => /^\d{1,4}$/.test(v); // сохранит "001"

export default function Login() {
  const navigate = useNavigate();

  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // валидность
  const validLogin = true
  const validPass  = true;
  const canSubmit  = true;

  const storage = remember ? localStorage : sessionStorage;

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      // 1) логин
      const data = await postJson(`${API}/api/auth/login/`, { login, password });

      if (data.accessToken) storage.setItem('access', data.accessToken);
      if (data.refreshToken) storage.setItem('refresh', data.refreshToken);

      // 2) разрешаем вход только активным жильцам
      try {
        const prof = await getJson(`${API}/api/profile/me/`);
        const isActive =
          (typeof prof?.is_active_resident !== 'undefined' ? prof.is_active_resident :
          (typeof prof?.is_active !== 'undefined'          ? prof.is_active :
          (typeof prof?.active !== 'undefined'             ? prof.active : true)));

        if (!isActive) {
          storage.removeItem('accessToken');
          storage.removeItem('refreshToken');
          throw new Error('Ваш профиль не активен. Обратитесь к администратору.');
        }
      } catch (e2) {
        // если профиль недоступен по сети — не блокируем авторизацию
      }

      navigate('/', { replace: true });
    } catch (err) {
      // понятные сообщения
      if (err.status === 400 || err.status === 401) {
        setError(err.message || 'Неверный логин или пароль');
      } else {
        setError(err.message || 'Не удалось войти. Попробуйте ещё раз.');
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
          <p>Введите номер квартиры и пароль, чтобы продолжить</p>
        </div>

        <form className={c.form} onSubmit={onSubmit} noValidate>
          <label className={c.label}>
            Номер квартиры - подъезд
            <input
              className={`${c.input} ${login && !validLogin ? c.error : ''}`}
              type="text"
              placeholder="001"
              value={login}
              onChange={(e) => setLogin(e.target.value)} // не убираем ведущие нули
              autoComplete="username"
              inputMode="text"
            />
            {!validLogin && login && (
              <span className={c.hint}>Пример: 001 • user@mail.com • +79990000000</span>
            )}
          </label>

          <label className={c.label}>
            Пароль
            <div className={c.passWrap}>
              <input
                className={`${c.input} ${password && !validPass ? c.error : ''}`}
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
            {!validPass && password && <span className={c.hint}>Минимум 6 символов</span>}
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
            {loading ? 'Входим…' : 'Войти'}
          </button>
        </form>
      </div>
    </div>
  );
}
