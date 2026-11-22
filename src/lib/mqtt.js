import { useEffect, useState } from "react";

/**
 * MQTT для паркинга (ESP32 с реле).
 *
 * Топики (prefix по умолчанию "aristokrat"):
 *   {prefix}/{device}/status         retained "online" | "offline" (LWT от ESP)
 *   {prefix}/{device}/{relay}/cmd    приложение -> ESP, payload = id запроса
 *   {prefix}/{device}/{relay}/ack    ESP -> приложение, payload = тот же id
 *   {prefix}/{device}/{relay}/state  ESP -> приложение, "1" пока реле замкнуто, "0" после
 *   {prefix}/{device}/{relay}/lock   приложение -> все (retained), время окончания блокировки, мс epoch
 *
 * Настройки берутся при сборке из .env.local (см. .env.example).
 */
const CFG = {
  url: process.env.REACT_APP_MQTT_URL || "",
  username: process.env.REACT_APP_MQTT_USERNAME || undefined,
  password: process.env.REACT_APP_MQTT_PASSWORD || undefined,
  prefix: (process.env.REACT_APP_MQTT_PREFIX || "aristokrat").replace(/\/+$/, ""),
};

export const mqttConfigured = !!CFG.url;

const ACK_TIMEOUT_MS = 6000;

let client = null;
let users = 0;
let snapshot = { connected: false, devices: {}, relays: {}, locks: {} };
const listeners = new Set();
const pending = new Map(); // id -> { resolve, reject, timer }

function emit(patch) {
  snapshot = { ...snapshot, ...patch };
  listeners.forEach((l) => l(snapshot));
}

function onMessage(topic, payload) {
  const parts = topic.slice(CFG.prefix.length + 1).split("/");
  const text = payload.toString();

  if (parts.length === 2 && parts[1] === "status") {
    emit({ devices: { ...snapshot.devices, [parts[0]]: text === "online" ? "online" : "offline" } });
    return;
  }
  if (parts.length !== 3) return;
  const [device, relay, kind] = parts;

  if (kind === "ack") {
    const p = pending.get(text);
    if (p) {
      clearTimeout(p.timer);
      pending.delete(text);
      p.resolve();
    }
  } else if (kind === "state") {
    emit({ relays: { ...snapshot.relays, [`${device}/${relay}`]: text === "1" } });
  } else if (kind === "lock") {
    const until = Number(text) || 0;
    emit({ locks: { ...snapshot.locks, [`${device}/${relay}`]: until } });
  }
}

let connecting = false;

async function connect() {
  if (client || connecting || !mqttConfigured) return;
  connecting = true;
  // библиотеку грузим только тем, у кого есть паркинг (−100 КБ для остальных)
  const { default: mqtt } = await import("mqtt");
  connecting = false;
  if (users === 0 || client) return;
  client = mqtt.connect(CFG.url, {
    username: CFG.username,
    password: CFG.password,
    clientId: `aristokrat-app-${Math.random().toString(16).slice(2, 10)}`,
    clean: true,
    keepalive: 30,
    reconnectPeriod: 2000,
    connectTimeout: 10000,
  });
  client.on("connect", () => {
    emit({ connected: true });
    client.subscribe(
      [
        `${CFG.prefix}/+/status`,
        `${CFG.prefix}/+/+/ack`,
        `${CFG.prefix}/+/+/state`,
        `${CFG.prefix}/+/+/lock`,
      ],
      { qos: 1 },
    );
  });
  client.on("close", () => emit({ connected: false }));
  client.on("offline", () => emit({ connected: false }));
  client.on("error", () => {});
  client.on("message", onMessage);
}

function disconnect() {
  if (!client) return;
  client.end(true);
  client = null;
  pending.forEach((p) => {
    clearTimeout(p.timer);
    p.reject(new Error("Соединение закрыто"));
  });
  pending.clear();
  emit({ connected: false, devices: {}, relays: {}, locks: {} });
}

/**
 * Отправить импульс на реле. Промис выполняется, только когда ESP
 * подтвердила получение команды (ack), — так «Открыто» в приложении честное.
 */
export function sendRelayPulse(device, relay) {
  if (!mqttConfigured) return Promise.reject(new Error("MQTT не настроен"));
  if (!client || !snapshot.connected) {
    return Promise.reject(new Error("Нет связи с сервером паркинга"));
  }
  if (snapshot.devices[device] !== "online") {
    return Promise.reject(new Error("Контроллер паркинга не в сети"));
  }
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Контроллер не ответил. Попробуйте ещё раз"));
    }, ACK_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    client.publish(`${CFG.prefix}/${device}/${relay}/cmd`, id, { qos: 1, retain: false }, (err) => {
      if (err) {
        clearTimeout(timer);
        pending.delete(id);
        reject(new Error("Не удалось отправить команду"));
      }
    });
  });
}

/**
 * Общая блокировка реле для всех пользователей: retained-сообщение со временем
 * окончания. Его получают и подключённые сейчас, и те, кто зайдёт позже.
 */
export function publishLock(device, relay, ms) {
  if (!client || !snapshot.connected) return;
  const until = Date.now() + ms;
  // показываем блокировку сразу, не дожидаясь эха от брокера
  emit({ locks: { ...snapshot.locks, [`${device}/${relay}`]: until } });
  client.publish(`${CFG.prefix}/${device}/${relay}/lock`, String(until), { qos: 1, retain: true });
}

/** Подписка компонента на состояние MQTT (держит соединение, пока смонтирован). */
export function useMqtt(enabled = true) {
  const [state, setState] = useState(snapshot);

  useEffect(() => {
    if (!enabled || !mqttConfigured) return;
    users += 1;
    connect();
    listeners.add(setState);
    setState(snapshot);
    return () => {
      listeners.delete(setState);
      users -= 1;
      if (users === 0) disconnect();
    };
  }, [enabled]);

  return state;
}
