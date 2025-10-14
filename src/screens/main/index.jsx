// Main.jsx
import React, { useEffect, useState } from 'react';
import c from './main.module.scss';
import { getResidentEntranceNo } from '../../api';
import logo from '../../images/logo.svg';

// === Firebase RTDB REST (без пакетов) ===
const DB_URL   = 'https://aristokrat-aa238-default-rtdb.asia-southeast1.firebasedatabase.app'; // <-- твой backend
const ID_TOKEN = null; // либо строка JWT, если запись закрыта правилами; иначе оставь null

const authQ = ID_TOKEN ? `?auth=${encodeURIComponent(ID_TOKEN)}` : '';

const rtdbSetBoolean = async (path, value) => {
  const url = `${DB_URL}${path}.json${authQ}`;
  const res = await fetch(url, {
    method: 'PUT',                             // можно PATCH, но PUT простее для булей
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(!!value),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`RTDB ${res.status}: ${text}`);
  }
};

// соответствие UI-ключ → RTDB-путь (БЕЗ .json на конце)
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
  const [entranceNo, setEntranceNo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [active, setActive] = useState({
    door:false, liftPass:false, liftGruz:false,
    kalitka1:false, kalitka2:false, kalitka3:false, kalitka4:false,
    parking:false,
  });
  const [busy, setBusy] = useState({ ...active });

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const no = await getResidentEntranceNo();
        if (!no) setErr('В профиле нет номера подъезда. Обратитесь к администратору.');
        setEntranceNo(no || null);
      } catch (e) {
        setErr(e?.message || 'Не удалось получить данные профиля');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Импульс: записать true -> через 1s записать false
  const pulse = async (key) => {
    if (busy[key]) return;

    const path = pathFor(key, entranceNo);
    if (!path) return;
    if ((key === 'door' || key === 'liftPass' || key === 'liftGruz') && !entranceNo) return;

    setBusy((s) => ({ ...s, [key]: true }));
    setActive((s) => ({ ...s, [key]: true }));
    try {
      await rtdbSetBoolean(path, true);
    } catch (e) {
      console.error('RTDB write true failed', e);
      setErr('Не удалось отправить команду. Попробуйте ещё раз.');
    }

    setTimeout(async () => {
      try {
        await rtdbSetBoolean(path, false);
      } catch (e) {
        console.error('RTDB write false failed', e);
        // даже если false не записался — UI отпустим; ESP всё равно даёт короткий импульс самостоятельно
      }
      setActive((s) => ({ ...s, [key]: false }));
      setBusy((s) => ({ ...s, [key]: false }));
    }, 1000);
  };

  const disabledByEntrance = loading || !entranceNo;

  return (
    <div className={c.main}>
      <div className={c.logo}>
        <img src={logo} alt="logo" />
      </div>

      {err && <div className={c.error}>{err}</div>}

      {/* Подъезд — только свой */}
      <button
        className={active.door ? c.active : ''}
        disabled={disabledByEntrance || busy.door}
        onClick={() => pulse('door')}
        title={disabledByEntrance ? 'Нет данных по вашему подъезду' : `Подъезд ${entranceNo}`}
      >
        Подъезд {entranceNo ? `№${entranceNo}` : ''}
      </button>

      {/* Лифты — только свой подъезд */}
      <div className={c.elevators}>
        <button
          className={active.liftPass ? c.active : ''}
          disabled={disabledByEntrance || busy.liftPass}
          onClick={() => pulse('liftPass')}
        >
          Лифт (пассажир)
        </button>
        <button
          className={active.liftGruz ? c.active : ''}
          disabled={disabledByEntrance || busy.liftGruz}
          onClick={() => pulse('liftGruz')}
        >
          Лифт (грузовой)
        </button>
      </div>

      {/* Калитки — глобальные */}
      <div className={c.doors}>
        <button
          className={active.kalitka1 ? c.active : ''}
          disabled={busy.kalitka1}
          onClick={() => pulse('kalitka1')}
        >
          Калитка №1
        </button>
        <button
          className={active.kalitka2 ? c.active : ''}
          disabled={busy.kalitka2}
          onClick={() => pulse('kalitka2')}
        >
          Калитка №2
        </button>
        <button
          className={active.kalitka3 ? c.active : ''}
          disabled={busy.kalitka3}
          onClick={() => pulse('kalitka3')}
        >
          Калитка №3
        </button>
        <button
          className={active.kalitka4 ? c.active : ''}
          disabled={busy.kalitka4}
          onClick={() => pulse('kalitka4')}
        >
          Калитка №4
        </button>
      </div>

      {/* Паркинг — глобальный */}
      <button
        className={active.parking ? c.active : ''}
        disabled={busy.parking}
        onClick={() => pulse('parking')}
      >
        Паркинг
      </button>
    </div>
  );
}
