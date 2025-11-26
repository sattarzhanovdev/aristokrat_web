// src/App.jsx
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MainRoutes } from './routes';
import { Components } from './components';
import './App.scss';
import { tryRefreshAccessToken, getMe, getResidentProfileMe, fetchJson } from './api';
import { clearTokens, tryInitialRefresh } from './api/axios';
import axios from 'axios';
// axios.defaults.baseURL = 'https://aristokratamanat.pythonanywhere.com';

// универсальная проверка флага "активен"
function isActiveResidentFlag(p) {
  if (!p || typeof p !== 'object') return true;
  if ('is_active_resident' in p) return !!p.is_active_resident;
  if ('is_active' in p)          return !!p.is_active;
  if ('active' in p)             return !!p.active;
  return true;
}

const PUBLIC_PATHS = new Set(['/login', '/forgot', '/reset']);

export default function App() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [ready, setReady] = React.useState(false);
  const mountedRef = React.useRef(true);
  const ranRef = React.useRef(false); // защита от двойного запуска в StrictMode

  React.useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  React.useEffect(() => {
    // Не даём эффекту бегать дважды в StrictMode при той же локации
    if (ranRef.current) return;
    ranRef.current = true;
    const unmark = () => { ranRef.current = false; };

    let canceled = false;

    (async () => {
      // Публичные страницы — просто отрисовываем роуты
      if (PUBLIC_PATHS.has(pathname)) {
        if (mountedRef.current && !canceled) setReady(true);
        return;
      }

      // Если вообще нет ни access, ни refresh — сразу на /login
      const hasAnyToken =
        localStorage.getItem('accessToken')  || sessionStorage.getItem('accessToken') ||
        localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');

      if (!hasAnyToken) {
        if (mountedRef.current && !canceled) {
          setReady(true);                 // не белый экран
          navigate('/login', { replace: true });
        }
        return;
      }

      // Ставит UI готовым заранее — чтобы не висеть пустым
      if (mountedRef.current && !canceled) setReady(true);

      // Тихо попробуем освежить access
      await tryRefreshAccessToken().catch(() => false);

      // /me — редиректим только на явный 401/403
      try {
        await getMe(); // со слэшем внутри api
      } catch (e) {
        const status = e?.response?.status ?? e?.status;
        if (status === 401 || status === 403) {
          clearTokens();
          if (mountedRef.current && !canceled) {
            navigate('/login', { replace: true });
          }
          return;
        }
        // прочие ошибки игнорим, UI уже отрисован
      }

      // профиль — если явно «не активен», тогда выкидываем
      try {
        const prof = await fetchJson("/api/profile/me");
        if (!isActiveResidentFlag(prof)) {
          clearTokens();
          if (mountedRef.current && !canceled) {
            navigate('/login', { replace: true });
          }
          return;
        }
      } catch {
        // профиль упал/не настроен — не блокируем
      }
    })();

    return () => { canceled = true; unmark(); };
  }, [pathname, navigate]);

  React.useEffect(() => {
    window.location.reload()
    if(localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken')){
      getResidentProfileMe()
      .then((prof) => {
        fetchJson('/api/apartments')
          .then((apts) => {
            const apt = apts.results.find((a) => a.number === prof.username);
            
            if (apt && apt.is_blocked) {
              clearTokens();
              alert('Ваше жильё заблокировано. Пожалуйста, обратитесь к администратору.');
              navigate('/login', { replace: true });
            }
          })
      })
    }
    (async () => {
      // если приватная страница и есть refresh — тихо обновим access заранее
      const hasRefresh =
        localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');

      if (hasRefresh) {
        await tryInitialRefresh(); // не важно, был access или нет
      }

      // далее как у тебя: getMe -> профиль -> проверки
      try {
        await getMe();
        // ...
      } catch (e) {
        const status = e?.response?.status ?? e?.status;
        if (status === 401 || status === 403) {
          clearTokens();
          navigate('/login', { replace: true });
          return;
        }
      }
      // ...
    })();
  }, []);

  // Можно показать лёгкий лоадер, но НЕ возвращать null надолго
  if (!ready) return <div style={{height:'100vh'}} />;

  return (
    <div>
      <Components.Navbar />
      <MainRoutes />
    </div>
  );
}
