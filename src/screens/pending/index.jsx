import React, { useState } from "react";
import { LuClock, LuCircleX } from "react-icons/lu";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ui/Toast";
import ui from "../../components/ui/ui.module.scss";
import c from "./pending.module.scss";

/** Экран для неподтверждённого / отклонённого аккаунта — вместо alert и выкидывания. */
export default function Pending() {
  const { user, revalidate, signOut } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const rejected = user?.approval_status === "rejected";

  const check = async () => {
    setBusy(true);
    const fresh = await revalidate({ force: true });
    setBusy(false);
    if (fresh?.approval_status === "accepted") toast("Аккаунт подтверждён", "success");
    else if (!fresh) toast("Не удалось связаться с сервером", "error");
    else toast("Статус пока не изменился", "info");
  };

  return (
    <div className={c.page}>
      <div className={`${c.icon} ${rejected ? c.iconBad : ""}`}>
        {rejected ? <LuCircleX /> : <LuClock />}
      </div>
      <h1>{rejected ? "Заявка отклонена" : "Ждём подтверждения"}</h1>
      <p>
        {rejected
          ? "Администратор отклонил доступ для этого аккаунта. Свяжитесь с управляющей компанией."
          : "Администратор ещё не подтвердил ваш аккаунт. Как только это произойдёт — всё откроется автоматически."}
      </p>
      <div className={c.actions}>
        {!rejected && (
          <button className={`${ui.btn} ${ui.btnPrimary}`} onClick={check} disabled={busy}>
            {busy ? <span className={ui.spinner} /> : "Проверить снова"}
          </button>
        )}
        <button className={`${ui.btn} ${ui.btnGhost}`} onClick={() => signOut()}>
          Выйти
        </button>
      </div>
    </div>
  );
}
