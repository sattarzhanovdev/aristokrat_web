import React, { useState } from "react";
import { LuPhone, LuCar, LuBuilding2, LuDoorOpen, LuHash, LuLogOut, LuShieldCheck } from "react-icons/lu";
import { useAuth } from "../../auth/AuthProvider";
import { ConfirmSheet } from "../../components/ui/Sheet";
import { haptic } from "../../lib/native";
import c from "./profile.module.scss";

export default function Profile() {
  const { user, isAdmin, signOut } = useAuth();
  const [confirm, setConfirm] = useState(false);

  const name = user?.name || user?.login || "Без имени";
  const apt = user?.apartment_no;

  const rows = [
    { icon: LuPhone, label: "Телефон", value: user?.phone },
    { icon: LuCar, label: "Автомобиль", value: user?.car_number },
    { icon: LuBuilding2, label: "Блок / дом", value: user?.house_number },
    { icon: LuDoorOpen, label: "Подъезд", value: user?.entrance_no },
    { icon: LuHash, label: "Квартира", value: String(apt) === "10000" ? null : apt },
  ];

  return (
    <div className={c.page}>
      <section className={c.head}>
        <div className={c.avatar}>{name.slice(0, 1).toUpperCase()}</div>
        <h2 className={c.name}>{name}</h2>
        <div className={c.badges}>
          <span className={`${c.badge} ${c.ok}`}>Аккаунт активен</span>
          {isAdmin && (
            <span className={`${c.badge} ${c.admin}`}>
              <LuShieldCheck /> Администратор
            </span>
          )}
        </div>
      </section>

      <div className={c.group}>
        {rows.map(({ icon: Icon, label, value }) => (
          <div key={label} className={c.row}>
            <span className={c.rowIcon}>
              <Icon />
            </span>
            <span className={c.rowLabel}>{label}</span>
            <span className={c.rowValue}>{value === null || value === undefined || value === "" ? "—" : value}</span>
          </div>
        ))}
      </div>

      <p className={c.note}>Чтобы изменить данные, обратитесь к администратору ЖК.</p>

      <div className={c.group}>
        <button
          className={`${c.row} ${c.rowBtn}`}
          onClick={() => {
            haptic.tap();
            setConfirm(true);
          }}
        >
          <span className={`${c.rowIcon} ${c.rowIconDanger}`}>
            <LuLogOut />
          </span>
          <span className={c.danger}>Выйти из аккаунта</span>
        </button>
      </div>

      <ConfirmSheet
        open={confirm}
        title="Выйти из аккаунта?"
        message="Чтобы снова открывать двери, нужно будет ввести логин и пароль."
        confirmLabel="Выйти"
        danger
        onConfirm={() => signOut()}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
