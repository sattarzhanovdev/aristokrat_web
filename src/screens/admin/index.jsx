import React, { useEffect, useMemo, useState } from 'react';
import c from './admin.module.scss';
import { useNavigate } from 'react-router-dom';
import { BiArrowBack } from 'react-icons/bi';
import { fetchJson } from '../../api';

const Admin = () => {
  const navigate = useNavigate();

  // === ГАРД ДОСТУПА ===
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me = await fetchJson('/api/auth/me');
        const isSuper = Boolean(me.is_superuser);
        const isStaff = Boolean(me.is_staff);
        if (!isSuper && !isStaff) {
          // нет прав — уводим на /
          navigate('/', { replace: true });
          return;
        }
      } catch (e) {
        // если не авторизован/ошибка — тоже уводим на /
        navigate('/', { replace: true });
        return;
      } finally {
        if (mounted) setAuthChecked(true);
      }
    })();
    return () => { mounted = false; };
  }, [navigate]);

  // UI state
  const [entrance, setEntrance] = useState('all');   // селект "Выберите блок"
  const [query, setQuery] = useState('');            // поиск
  const [selectedApartment, setSelectedApartment] = useState(null);

  // data state
  const [apartments, setApartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // дебаунс поиска
  const [debouncedQuery, setDebouncedQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // загрузка списка
  useEffect(() => {
    if (!authChecked) return; // ждём проверку доступа
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr('');

        const params = new URLSearchParams();
        // при желании можно фильтровать по дому: params.set('house','20')
        if (entrance !== 'all') params.set('entrance', entrance);
        if (debouncedQuery) params.set('search', debouncedQuery);

        const data = await fetchJson(`/api/apartments?${params.toString()}`);
        const list = Array.isArray(data) ? data : (data.results || []);
        if (mounted) setApartments(list);
      } catch (e) {
        if (mounted) setErr(e.message || 'Не удалось загрузить квартиры');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [authChecked, entrance, debouncedQuery]);

  // открыть попап
  const openApartment = async (ap) => {
    try {
      const detail = await fetchJson(`/api/apartments/${ap.id}/`);
      setSelectedApartment(detail);
    } catch {
      setSelectedApartment(ap);
    }
  };

  // блокировка / разблокировка
  const toggleBlock = async () => {
    if (!selectedApartment) return;
    try {
      if (selectedApartment.is_blocked || selectedApartment.status === 'Заблокирована') {
        // РАЗБЛОКИРОВАТЬ
        const updated = await fetchJson(`/api/apartments/${selectedApartment.id}/`, {
          method: 'PATCH',
          body: JSON.stringify({ is_blocked: false }),
        });
        setSelectedApartment(updated);
      } else {
        // ЗАБЛОКИРОВАТЬ
        await fetchJson(`/api/apartments/${selectedApartment.id}/block/`, {
          method: 'PATCH',
        });
        const updated = await fetchJson(`/api/apartments/${selectedApartment.id}/`);
        setSelectedApartment(updated);
      }

      // обновим список
      const params = new URLSearchParams();
      if (entrance !== 'all') params.set('entrance', entrance);
      if (debouncedQuery) params.set('search', debouncedQuery);
      const refreshed = await fetchJson(`/api/apartments?${params.toString()}`);
      const list = Array.isArray(refreshed) ? refreshed : (refreshed.results || []);
      setApartments(list);
    } catch (e) {
      alert('Не имеете прав для этого действия');
    }
  };

  // подпись для статуса
  const statusLabel = useMemo(() => {
    if (!selectedApartment) return '';
    const blocked = selectedApartment.is_blocked ?? (selectedApartment.status === 'Заблокирована');
    return blocked ? 'Заблокирована' : 'Активна';
  }, [selectedApartment]);

  // пока проверяем доступ — ничего не показываем (чтобы не мигал UI)
  if (!authChecked) return null;

  return (
    <div className={c.admin}>
      {/* Назад */}
      <div className={c.back} onClick={() => navigate('/')}>
        <BiArrowBack />
      </div>

      {/* Поиск */}
      <input
        type="text"
        placeholder="Номер квартиры"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {/* Фильтр по подъезду/блоку */}
      <select
        value={entrance}
        onChange={(e) => setEntrance(e.target.value)}
      >
        <option value="all">Все блоки</option>
        <option value="1">1</option>
        <option value="2">2</option>
        {/* при необходимости добавь 3,4 ... */}
      </select>

      <h2>Блок: {entrance === 'all' ? 'Все' : entrance}</h2>

      {/* Список/состояния */}
      {loading && <div className={c.loading}>Загрузка…</div>}
      {err && <div className={c.error}>{err}</div>}

      <div className={c.apartments}>
        {!loading && !err && apartments.map((ap) => (
          <button key={ap.id} onClick={() => openApartment(ap)}>
            {ap.number}{ap.is_blocked ? ' 🔒' : ''}
          </button>
        ))}
        {!loading && !err && apartments.length === 0 && (
          <div className={c.empty}>Ничего не найдено</div>
        )}
      </div>

      {/* Popup */}
      {selectedApartment && (
        <div className={c.popupOverlay} onClick={() => setSelectedApartment(null)}>
          <div className={c.popup} onClick={(e) => e.stopPropagation()}>
            <h3>Квартира №{selectedApartment.number}</h3>
            <p><b>Владелец:</b> {selectedApartment.owner_name || '—'}</p>
            <p><b>Статус:</b> {statusLabel}</p>

            <button className={c.blockBtn} onClick={toggleBlock}>
              {statusLabel === 'Активна' ? 'Заблокировать' : 'Разблокировать'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
