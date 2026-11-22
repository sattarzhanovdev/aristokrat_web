import React, { useEffect, useState } from "react";
import { LuCheck, LuCircleAlert, LuLock, LuWifiOff } from "react-icons/lu";
import { MdLocalParking } from "react-icons/md";
import { TbBarrierBlock } from "react-icons/tb";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ui/Toast";
import { haptic } from "../../lib/native";
import { useMqtt, sendRelayPulse, publishLock, mqttConfigured } from "../../lib/mqtt";
import { usePulse } from "./useDevices";
import c from "./main.module.scss";

// после открытия ворота паркинга 2 блокируются для всех на это время
const PARKING2_LOCK_MS = 20000;

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
};

function Control({ icon: Icon, label, keyName, send, live, status, onPress, unavailable, lockLeft = 0, lockTotal = 1 }) {
  const st = status[keyName];
  const isLive = !!live[keyName];
  const lockSec = Math.ceil(lockLeft / 1000);
  const isLocked = lockLeft > 0 && !st;

  const hint =
    st === "sending"
      ? "Отправляем…"
      : st === "opened"
        ? "Открыто"
        : st === "error"
          ? "Ошибка, повторите"
          : isLocked
            ? `Снова через ${lockSec} с`
            : unavailable
              ? unavailable
              : isLive
                ? "Сейчас открыто"
                : "Открыть";

  const StateIcon =
    st === "opened" ? LuCheck : st === "error" ? LuCircleAlert : unavailable ? LuWifiOff : Icon;

  return (
    <button
      type="button"
      className={[
        c.control,
        st ? c[`st_${st}`] : "",
        isLive && !st ? c.isLive : "",
        unavailable && !st && !isLocked ? c.isUnavailable : "",
        isLocked ? c.isLocked : "",
      ].join(" ")}
      style={isLocked ? { "--p": lockLeft / lockTotal } : undefined}
      onClick={() => onPress(keyName, label, send)}
      disabled={st === "sending"}
      aria-label={`${label}: ${hint}`}
    >
      <span className={c.orb}>
        {st === "sending" ? (
          <span className={c.ring} />
        ) : isLocked ? (
          <span className={c.count}>
            <LuLock />
            {lockSec}
          </span>
        ) : (
          <StateIcon />
        )}
      </span>
      <span className={c.text}>
        <span className={c.label}>{label}</span>
        <span className={c.hint}>
          {isLive && !st && !unavailable && !isLocked && <span className={c.dot} />}
          {hint}
        </span>
      </span>
    </button>
  );
}

export default function Main() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { status, run } = usePulse();

  const apartment = user?.apartment_no ?? null;
  const isService = String(apartment) === "10000";
  const hasParking = !!user?.has_parking;
  const showParking = isAdmin || hasParking;

  const mq = useMqtt(showParking);

  // блокировка паркинга 2: перерисовываемся, пока идёт отсчёт
  const lock2Until = mq.locks["parking2/gate"] || 0;
  const [, tick] = useState(0);
  useEffect(() => {
    if (lock2Until <= Date.now()) return;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (Date.now() >= lock2Until) clearInterval(t);
    }, 250);
    return () => clearInterval(t);
  }, [lock2Until]);
  // ограничиваем сверху: у телефона могут спешить часы
  const lock2Left = Math.min(PARKING2_LOCK_MS, Math.max(0, lock2Until - Date.now()));

  // живое состояние паркинга из MQTT
  const live = {
    shlagbaum: !!mq.relays["parking1/barrier"],
    parking1: !!mq.relays["parking1/gate"],
    parking2: !!mq.relays["parking2/gate"],
  };

  const parkingUnavailable = (device) => {
    if (!mqttConfigured) return "Не настроено";
    if (!mq.connected) return "Подключение…";
    // нет статуса = контроллер ни разу не подключался к брокеру
    if (mq.devices[device] !== "online") return "Не в сети";
    return null;
  };

  const lockLeftFor = (key) => (key === "parking2" ? lock2Left : 0);

  const onPress = async (key, label, send) => {
    if (status[key] === "sending") return;
    haptic.tap();
    const left = lockLeftFor(key);
    if (left > 0) {
      toast(`${label}: снова можно через ${Math.ceil(left / 1000)} с`, "info");
      return;
    }
    if (live[key]) {
      toast(`${label}: уже открыто`, "info");
      return;
    }
    const res = await run(key, send);
    if (res.ok) {
      haptic.success();
      toast(`${label} — открыто`, "success");
    } else {
      haptic.error();
      toast(res.error, "error", 3000);
    }
  };

  const relay = (device, name) => () => sendRelayPulse(device, name);
  const ctl = { live, status, onPress };
  const name = isAdmin ? "Администратор" : user?.name || "Житель";

  return (
    <div className={c.page}>
      <section className={c.hello}>
        <div>
          <div className={c.greet}>{greeting()}</div>
          <div className={c.name}>{name}</div>
        </div>
        <div className={c.chips}>
          {!isAdmin && apartment && !isService && <span className={c.chip}>Кв. {apartment}</span>}
          {hasParking && <span className={c.chip}>Паркинг</span>}
          {showParking && (
            <span className={`${c.chip} ${mq.connected ? c.chipOk : c.chipWait}`}>
              <span className={c.statusDot} />
              {mq.connected ? "На связи" : "Подключение…"}
            </span>
          )}
        </div>
      </section>

      {!showParking && (
        <p className={c.empty}>
          У вас нет доступа к паркингу. Обратитесь к администратору, если это ошибка.
        </p>
      )}

      {showParking && (
        <>
          <section className={c.panel}>
            <div className={c.panelHead}>
              <h2 className={c.section}>Паркинг</h2>
              <span className={c.panelNo}>1</span>
            </div>
            <div className={c.row}>
              <Control
                {...ctl}
                icon={TbBarrierBlock}
                label="Шлагбаум"
                keyName="shlagbaum"
                send={relay("parking1", "barrier")}
                unavailable={parkingUnavailable("parking1")}
              />
              <Control
                {...ctl}
                icon={MdLocalParking}
                label="Ворота"
                keyName="parking1"
                send={relay("parking1", "gate")}
                unavailable={parkingUnavailable("parking1")}
              />
            </div>
          </section>

          <section className={c.panel}>
            <div className={c.panelHead}>
              <h2 className={c.section}>Паркинг</h2>
              <span className={c.panelNo}>2</span>
            </div>
            <div className={c.row}>
              <Control
                {...ctl}
                icon={MdLocalParking}
                label="Ворота"
                keyName="parking2"
                send={async () => {
                  await sendRelayPulse("parking2", "gate");
                  publishLock("parking2", "gate", PARKING2_LOCK_MS);
                }}
                unavailable={parkingUnavailable("parking2")}
                lockLeft={lock2Left}
                lockTotal={PARKING2_LOCK_MS}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
