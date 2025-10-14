import React, { useEffect, useState } from 'react';
import c from './main.module.scss';
import { getResidentEntranceNo, getIsAdmin } from '../../api';
import logo from '../../images/logo.svg';

// === Firebase RTDB REST ===
const DB_URL   = 'https://aristokrat-aa238-default-rtdb.asia-southeast1.firebasedatabase.app';
const ID_TOKEN = null; // если нужны права — положи сюда JWT

const authQ = ID_TOKEN ? `?auth=${encodeURIComponent(ID_TOKEN)}` : '';
const rtdbSetBoolean = async (path, value) => {
  const url = `${DB_URL}${path}.json${authQ}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(!!value),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RTDB ${res.status}: ${text}`);
  }
};

const pathFor = (key, entranceNo) => {
  switch (key) {
    case 'door':     return `/entrances/${entranceNo}/door/value`;
    case 'liftPass': return `/entrances/${entranceNo}/lift_pass/value`;
    case 'liftGruz': return `/entrances/${entranceNo}/lift_gruz/value`;
    case 'kalitka1': return `/kalitka1/value`;
    case 'kalitka2': return `/kalitka2/value`;
    case 'kalitka3': return `/kalitka3/value`;
    case 'kalitka4': return `/kalitka4/value`;
    case 'parking':  return `/parking/value`;
    default:         return null;
  }
};

export default function Main() {
  const [entranceNo, setEntranceNo] = useState(null);  // подъезд жильца
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // локальный актив/занят для визуала (ключ -> boolean)
  const [active, setActive] = useState({});
  const [busy, setBusy] = useState({});

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [adminFlag, no] = await Promise.all([
          getIsAdmin(),
          getResidentEntranceNo().catch(() => null),
        ]);
        setIsAdmin(adminFlag);
        setEntranceNo(no || null);

        // если не админ и нет номера подъезда — покажем ошибку
        if (!adminFlag && !no) {
          setErr('В профиле нет номера подъезда. Обратитесь к администратору.');
        }
      } catch (e) {
        setErr(e?.message || 'Не удалось получить данные профиля');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Импульс: записать true -> через 1s false
  const pulse = async (key, enNo = null) => {
    const entranceTarget = enNo ?? entranceNo; // для админа может прийти конкретный подъезд
    const needsEntrance = key === 'door' || key === 'liftPass' || key === 'liftGruz';
    if (needsEntrance && !entranceTarget) return;

    const path = pathFor(key, entranceTarget);
    if (!path) return;

    const busyKey = `${key}-${entranceTarget || 'global'}`;
    if (busy[busyKey]) return;

    setBusy((s) => ({ ...s, [busyKey]: true }));
    setActive((s) => ({ ...s, [busyKey]: true }));

    try { await rtdbSetBoolean(path, true); }
    catch (e) { console.error('RTDB write true failed', e); setErr('Не удалось отправить команду.'); }

    setTimeout(async () => {
      try { await rtdbSetBoolean(path, false); }
      catch (e) { console.error('RTDB write false failed', e); }
      setActive((s) => ({ ...s, [busyKey]: false }));
      setBusy((s) => ({ ...s, [busyKey]: false }));
    }, 1000);
  };

  const btnClass = (key, enNo=null) => active[`${key}-${enNo ?? 'global'}`] ? c.active : '';
  const btnDisabled = (key, enNo=null) => !!busy[`${key}-${enNo ?? 'global'}`];

  return (
    <div className={c.main}>
      <div className={c.logo}><img src={logo} alt="logo" /></div>
      {err && <div className={c.error}>{err}</div>}

      {/* ---- Админ: показать все подъезды 1..8 ---- */}
      {!loading && isAdmin && (
        <>
          <h3 className={c.section}>Подъезды (админ)</h3>
          <div className={c.grid}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((no) => (
              <div key={no} className={c.entranceCard}>
                <div className={c.entranceTitle}>Подъезд №{no}</div>
                <div className={c.entranceButtons}>
                  <button
                    className={btnClass('door', no)}
                    disabled={btnDisabled('door', no)}
                    onClick={() => pulse('door', no)}
                  >
                    Дверь
                  </button>
                  <button
                    className={btnClass('liftPass', no)}
                    disabled={btnDisabled('liftPass', no)}
                    onClick={() => pulse('liftPass', no)}
                  >
                    Лифт (пасс.)
                  </button>
                  <button
                    className={btnClass('liftGruz', no)}
                    disabled={btnDisabled('liftGruz', no)}
                    onClick={() => pulse('liftGruz', no)}
                  >
                    Лифт (груз.)
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---- Обычный пользователь: только свой подъезд ---- */}
      {!loading && !isAdmin && entranceNo && (
        <>
          <button
            className={btnClass('door', entranceNo)}
            disabled={btnDisabled('door', entranceNo)}
            onClick={() => pulse('door', entranceNo)}
            title={`Подъезд ${entranceNo}`}
          >
            Подъезд №{entranceNo}
          </button>

          <div className={c.elevators}>
            <button
              className={btnClass('liftPass', entranceNo)}
              disabled={btnDisabled('liftPass', entranceNo)}
              onClick={() => pulse('liftPass', entranceNo)}
            >
              Лифт (пассажир)
            </button>
            <button
              className={btnClass('liftGruz', entranceNo)}
              disabled={btnDisabled('liftGruz', entranceNo)}
              onClick={() => pulse('liftGruz', entranceNo)}
            >
              Лифт (грузовой)
            </button>
          </div>
        </>
      )}

      {/* ---- Глобальные (для всех): калитки и паркинг ---- */}
      {!loading && (
        <>
          <div className={c.doors}>
            <button
              className={btnClass('kalitka1')}
              disabled={btnDisabled('kalitka1')}
              onClick={() => pulse('kalitka1')}
            >Калитка №1</button>
            <button
              className={btnClass('kalitka2')}
              disabled={btnDisabled('kalitka2')}
              onClick={() => pulse('kalitka2')}
            >Калитка №2</button>
            <button
              className={btnClass('kalitka3')}
              disabled={btnDisabled('kalitka3')}
              onClick={() => pulse('kalitka3')}
            >Калитка №3</button>
            <button
              className={btnClass('kalitka4')}
              disabled={btnDisabled('kalitka4')}
              onClick={() => pulse('kalitka4')}
            >Калитка №4</button>
          </div>

          <button
            className={btnClass('parking')}
            disabled={btnDisabled('parking')}
            onClick={() => pulse('parking')}
          >
            Паркинг
          </button>
        </>
      )}
    </div>
  );
}
