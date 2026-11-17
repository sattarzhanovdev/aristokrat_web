import React, { useState } from "react";
import { LuDoorOpen, LuCheck, LuCircleAlert, LuFence, LuWifiOff } from "react-icons/lu";
import { MdElevator, MdLocalParking } from "react-icons/md";
import { TbBarrierBlock } from "react-icons/tb";
import { useAuth } from "../../auth/AuthProvider";
import { useToast } from "../../components/ui/Toast";
import { haptic } from "../../lib/native";
import { useMqtt, sendRelayPulse, mqttConfigured } from "../../lib/mqtt";
import { useLiveDevices, usePulse, firebasePulse } from "./useDevices";
import c from "./main.module.scss";

const ENTRANCES = [1, 2, 3, 4, 5, 6, 7, 8];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return "Доброй ночи";
  if (h < 12) return "Доброе утро";
  if (h < 18) return "Добрый день";
  return "Добрый вечер";
};

function Control({ icon: Icon, label, keyName, send, variant = "tile", live, status, onPress, unavailable }) {
  const st = status[keyName];
  const isLive = !!live[keyName];

  const hint =
    st === "sending"
      ? "Отправляем…"
      : st === "opened"
        ? "Открыто"
        : st === "error"
          ? "Ошибка, повторите"
          : unavailable
            ? unavailable
            : isLive
              ? "Сейчас открыто"
              : "Нажмите, чтобы открыть";

  const StateIcon =
    st === "opened" ? LuCheck : st === "error" ? LuCircleAlert : unavailable ? LuWifiOff : Icon;

  return (
    <button
      type="button"
      className={[
        c.control,
        c[variant],
        st ? c[`st_${st}`] : "",
        isLive && !st ? c.isLive : "",
        unavailable && !st ? c.isUnavailable : "",
      ].join(" ")}
      onClick={() => onPress(keyName, label, send)}
      disabled={st === "sending"}
      aria-label={`${label}: ${hint}`}
    >
      <span className={c.iconWrap}>
        {st === "sending" ? <span className={c.ring} /> : <StateIcon />}
      </span>
      <span className={c.text}>
        <span className={c.label}>{label}</span>
        <span className={c.hint}>
          {isLive && !st && !unavailable && <span className={c.dot} />}
          {hint}
        </span>
      </span>
    </button>
  );
}

export default function Main() {
  const { user, isAdmin } = useAuth();
  const toast = useToast();
  const { live: fbLive, connected } = useLiveDevices(true);
  const { status, run } = usePulse();

  const ownEntrance = user?.entrance_no ?? null;
  const apartment = user?.apartment_no ?? null;
  const isService = String(apartment) === "10000";
  const hasParking = !!user?.has_parking;
  const showParking = isAdmin || hasParking;
  const [adminEntrance, setAdminEntrance] = useState(ownEntrance || 1);

  const mq = useMqtt(showParking);
  const entrance = isAdmin ? adminEntrance : ownEntrance;

  // живое состояние: двери/калитки из Firebase, паркинг из MQTT
  const live = {
    ...fbLive,
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

  const onPress = async (key, label, send) => {
    if (status[key] === "sending") return;
    haptic.tap();
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

  const fb = (path) => () => firebasePulse(path);
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
          {!isAdmin && ownEntrance && <span className={c.chip}>Подъезд {ownEntrance}</span>}
          {!isAdmin && apartment && !isService && <span className={c.chip}>Кв. {apartment}</span>}
          {hasParking && <span className={c.chip}>Паркинг</span>}
          <span className={`${c.chip} ${connected ? c.chipOk : c.chipWait}`}>
            <span className={c.statusDot} />
            {connected ? "На связи" : "Подключение…"}
          </span>
        </div>
      </section>

      {isAdmin && (
        <div className={c.segment} role="tablist" aria-label="Подъезд">
          {ENTRANCES.map((no) => (
            <button
              key={no}
              role="tab"
              aria-selected={adminEntrance === no}
              className={adminEntrance === no ? c.segActive : ""}
              onClick={() => {
                haptic.tap();
                setAdminEntrance(no);
              }}
            >
              {no}
            </button>
          ))}
        </div>
      )}

      {entrance && !isService && (
        <>
          <Control
            {...ctl}
            variant="hero"
            icon={LuDoorOpen}
            label={`Подъезд №${entrance}`}
            keyName={`door-${entrance}`}
            send={fb(`/entrances/${entrance}/door/value`)}
          />

          <h2 className={c.section}>Лифты</h2>
          <div className={c.grid2}>
            <Control
              {...ctl}
              icon={MdElevator}
              label="Пассажирский"
              keyName={`liftPass-${entrance}`}
              send={fb(`/entrances/${entrance}/lift_pass/value`)}
            />
            <Control
              {...ctl}
              icon={MdElevator}
              label="Грузовой"
              keyName={`liftGruz-${entrance}`}
              send={fb(`/entrances/${entrance}/lift_gruz/value`)}
            />
          </div>
        </>
      )}

      {!isService && (
        <>
          <h2 className={c.section}>Калитки</h2>
          <div className={c.grid4}>
            {[1, 2, 3, 4].map((n) => (
              <Control
                key={n}
                {...ctl}
                icon={LuFence}
                label={`Калитка №${n}`}
                keyName={`kalitka${n}`}
                send={fb(`/kalitka${n}/value`)}
              />
            ))}
          </div>
        </>
      )}

      {showParking && (
        <>
          <h2 className={c.section}>Паркинг 1</h2>
          <div className={c.grid2}>
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

          <h2 className={c.section}>Паркинг 2</h2>
          <Control
            {...ctl}
            variant="wide"
            icon={MdLocalParking}
            label="Ворота паркинга 2"
            keyName="parking2"
            send={relay("parking2", "gate")}
            unavailable={parkingUnavailable("parking2")}
          />
        </>
      )}
    </div>
  );
}
