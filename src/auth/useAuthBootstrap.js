// src/auth/useAuthBootstrap.js
import { useEffect, useState } from 'react';
import { tryRefreshAccessToken, getMe, getResidentProfileMe } from '../api';

export function useAuthBootstrap() {
  const [ready, setReady] = useState(false);
  const [allowed, setAllowed] = useState(false); // можно ли пускать дальше

  useEffect(() => {
    (async () => {
      try {
        // молча обновим access сразу при заходе
        await tryRefreshAccessToken();
        // проверим пользователя
        await getMe(); // если 401 — перехватится внутри fetchJson -> tryRefresh уже был
        // проверим профиль
        const prof = await getResidentProfileMe().catch(() => null);
        const isActive = prof?.is_active_resident ?? true; // если поле не пришло, не блокируем
        setAllowed(Boolean(isActive));
      } catch {
        setAllowed(false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  return { ready, allowed };
}
