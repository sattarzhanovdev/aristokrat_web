import React, { useEffect, useState } from "react";
import c from "./profile.module.scss";
import { BiArrowBack } from "react-icons/bi";
import { useNavigate } from "react-router-dom";

import { getUser, clearUser } from "../../api";

export default function Profile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const user = getUser();

        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        if (!mounted) return;

        setData({
          name: user.name || user.login || "",
          phone: user.phone || "",
          car_number: user.car_number || "",
          house_number: user.house_number ?? "—",
          entrance_no: user.entrance_no ?? "—",
          apartment_no: user.apartment_no || "",
          status:
            user.approval_status === "accepted"
              ? "Активен"
              : "Не подтверждён",
        });
      } catch (e) {
        if (mounted) setErr("Не удалось загрузить профиль");
      } finally {
        mounted && setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  const logout = () => {
    clearUser();
    navigate("/login", { replace: true });
  };

  return (
    <div className={c.profile}>
      <button
        className={c.back}
        onClick={() => navigate("/")}
        aria-label="Назад"
      >
        <BiArrowBack />
      </button>

      {loading ? (
        <div className={c.skel}>Загружаем профиль…</div>
      ) : err ? (
        <div className={c.error}>{err}</div>
      ) : (
        <div className={c.card}>
          <div className={c.header}>
            <div className={c.avatar}>
              {(data.name || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className={c.headText}>
              <h2>{data.name || "Без имени"}</h2>
              <span
                className={`${c.badge} ${
                  data.status === "Активен" ? c.ok : c.block
                }`}
              >
                {data.status}
              </span>
            </div>
          </div>

          <div className={c.info}>
            <div>
              <b>Телефон:</b> {data.phone || "—"}
            </div>
            <div>
              <b>Авто:</b> {data.car_number || "—"}
            </div>
            <div>
              <b>Блок / дом:</b> {data.house_number}
            </div>
            <div>
              <b>Подъезд:</b> {data.entrance_no}
            </div>
            <div>
              <b>Квартира:</b> {data.apartment_no || "—"}
            </div>
          </div>

          <div className={c.actions}>
            <button className={c.danger} onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
