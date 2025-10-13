import React, { useEffect, useState } from 'react';
import c from './main.module.scss';
import { postBoolean, getResidentEntranceNo } from '../../api';
import logo from '../../images/logo.svg'

const ep = {
  door:      (no) => `/api/entrances/${no}/door/`,
  liftPass:  (no) => `/api/entrances/${no}/lift_pass/`,
  liftGruz:  (no) => `/api/entrances/${no}/lift_gruz/`,
  kalitka1:  () => `/api/kalitka1/`,
  kalitka2:  () => `/api/kalitka2/`,
  kalitka3:  () => `/api/kalitka3/`,
  kalitka4:  () => `/api/kalitka4/`,
  parking:   () => `/api/parking/`,
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
        const no = await getResidentEntranceNo(); // читает /api/profile/me
        if (!no) {
          setErr('В профиле нет номера подъезда. Обратитесь к администратору.');
        }
        setEntranceNo(no || null);
      } catch (e) {
        setErr(e.message || 'Не удалось получить данные профиля');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pulse = async (key, path) => {
    if (busy[key]) return;
    setBusy((s) => ({ ...s, [key]: true }));
    setActive((s) => ({ ...s, [key]: true }));
    try { await postBoolean(path, true); } catch {}
    setTimeout(async () => {
      try { await postBoolean(path, false); } catch {}
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

      {/* Подъезд — ТОЛЬКО свой */}
      <button
        className={active.door ? c.active : ''}
        disabled={disabledByEntrance || busy.door}
        onClick={() => pulse('door', ep.door(entranceNo))}
        title={disabledByEntrance ? 'Нет данных по вашему подъезду' : `Подъезд ${entranceNo}`}
      >
        Подъезд {entranceNo ? `№${entranceNo}` : ''}
      </button>

      {/* Лифты — ТОЛЬКО свой подъезд */}
      <div className={c.elevators}>
        <button
          className={active.liftPass ? c.active : ''}
          disabled={disabledByEntrance || busy.liftPass}
          onClick={() => pulse('liftPass', ep.liftPass(entranceNo))}
        >
          Лифт (пассажир)
        </button>
        <button
          className={active.liftGruz ? c.active : ''}
          disabled={disabledByEntrance || busy.liftGruz}
          onClick={() => pulse('liftGruz', ep.liftGruz(entranceNo))}
        >
          Лифт (грузовой)
        </button>
      </div>

      {/* Калитки — глобальные */}
      <div className={c.doors}>
        <button
          className={active.kalitka1 ? c.active : ''}
          disabled={busy.kalitka1}
          onClick={() => pulse('kalitka1', ep.kalitka1())}
        >
          Калитка №1
        </button>
        <button
          className={active.kalitka2 ? c.active : ''}
          disabled={busy.kalitka2}
          onClick={() => pulse('kalitka2', ep.kalitka2())}
        >
          Калитка №2
        </button>
        <button
          className={active.kalitka3 ? c.active : ''}
          disabled={busy.kalitka3}
          onClick={() => pulse('kalitka3', ep.kalitka3())}
        >
          Калитка №3
        </button>
        <button
          className={active.kalitka4 ? c.active : ''}
          disabled={busy.kalitka4}
          onClick={() => pulse('kalitka4', ep.kalitka4())}
        >
          Калитка №4
        </button>
      </div>

      {/* Паркинг — глобальный */}
      <button
        className={active.parking ? c.active : ''}
        disabled={busy.parking}
        onClick={() => pulse('parking', ep.parking())}
      >
        Паркинг
      </button>
    </div>
  );
}
