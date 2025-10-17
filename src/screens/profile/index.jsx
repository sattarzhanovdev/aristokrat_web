import React, { useEffect, useState } from 'react';
import c from './profile.module.scss';
import { BiArrowBack } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { fetchJson, clearTokens } from "../../api";

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [data, setData] = useState({
    name: '',
    phone: '',
    car_number: '',
    house_number: null,
    entrance_no: null,
    apartment_no: '',
    status: 'Активен',
  });

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setErr('');

        // 1) базовый пользователь
        const me = await fetchJson('/api/auth/me'); // <— без полного URL, хелпер сам подставит API_BASE
        const name =
          [me.last_name, me.first_name].filter(Boolean).join(' ') ||
          me.username ||
          '';

        // 2) профиль жильца
        // ожидается JSON: { phone, car_number, house_number, entrance_no, apartment_no, status }
        let prof = {};
        try {
          prof = await fetchJson('/api/profile/me'); // GET
        } catch {
          prof = {};
        }

        if (!mounted) return;
        setData({
          name,
          phone: prof.phone || '',
          car_number: prof.car_number || '',
          house_number: prof.house_number ?? null,
          entrance_no: prof.entrance_no ?? null,
          apartment_no: prof.apartment_no || '',
          status:
            prof.status ||
            (me.is_active === false ? 'Заблокирован' : 'Активен'),
        });
      } catch (e) {
        if (mounted) setErr(e.message || 'Не удалось загрузить профиль');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const logout = async () => {
    try { await fetchJson("/api/auth/logout", { method: "POST" }); } catch {}
    clearTokens();
    navigate("/login", { replace: true });
  };

  return (
    <div className={c.profile}>
      <button className={c.back} onClick={() => navigate('/')} aria-label="Назад">
        <BiArrowBack />
      </button>

      {loading ? (
        <div className={c.skel}>Загружаем профиль…</div>
      ) : err ? (
        <div className={c.error}>{err}</div>
      ) : (
        <div className={c.card}>
          <div className={c.header}>
            <div className={c.avatar}>{(data.name || 'U').slice(0, 1).toUpperCase()}</div>
            <div className={c.headText}>
              <h2>{data.name || 'Без имени'}</h2>
              <span className={`${c.badge} ${data.status === 'Активен' ? c.ok : c.block}`}>
                {data.status}
              </span>
            </div>
          </div>

          <div className={c.info}>
            <div><b>Телефон:</b> {data.phone || '—'}</div>
            <div><b>Авто:</b> {data.car_number || '—'}</div>
            <div><b>Блок / дом:</b> {data.house_number ?? '—'}</div>
            <div><b>Подъезд:</b> {data.entrance_no ?? '—'}</div>
            <div><b>Квартира:</b> {data.apartment_no || '—'}</div>
          </div>

          <div className={c.actions}>
            <button className={c.danger} onClick={logout}>Выйти</button>
          </div>
        </div>
      )}
    </div>
  );
}
