import { useCallback, useEffect, useRef, useState } from "react";

const DB_URL =
  "https://aristokrat-aa238-default-rtdb.asia-southeast1.firebasedatabase.app";
const toUrl = (path) => `${DB_URL}${path}.json`;

const toBool = (v) => v === true || v === "true" || v === 1 || v === "1";

/** Иммутабельно кладёт data в tree по пути "/a/b" (put) или сливает (patch). */
function applyAt(tree, path, data, merge) {
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) {
    return merge ? { ...(tree || {}), ...(data || {}) } : data;
  }
  const [head, ...rest] = parts;
  const base = tree && typeof tree === "object" ? tree : {};
  return { ...base, [head]: applyAt(base[head], "/" + rest.join("/"), data, merge) };
}

/** Состояние устройств по ключам, которые использует интерфейс. */
function deriveLive(t) {
  const out = {};
  if (!t || typeof t !== "object") return out;
  Object.entries(t.entrances || {}).forEach(([no, e]) => {
    out[`door-${no}`] = toBool(e?.door?.value);
    out[`liftPass-${no}`] = toBool(e?.lift_pass?.value);
    out[`liftGruz-${no}`] = toBool(e?.lift_gruz?.value);
  });
  [1, 2, 3, 4].forEach((n) => {
    if (t[`kalitka${n}`]) out[`kalitka${n}`] = toBool(t[`kalitka${n}`].value);
  });
  if (t.vorota1) {
    out.parking1 = toBool(t.vorota1.value);
    out.shlagbaum = toBool(t.vorota1.shlagbaum);
  }
  if (t.vorota2) out.parking2 = toBool(t.vorota2.value);
  return out;
}

/**
 * Живое состояние из Firebase (SSE) с автопереподключением.
 * Раньше слушался только `message`, а Firebase шлёт события `put`/`patch`,
 * и при первой же ошибке поток закрывался навсегда.
 */
export function useLiveDevices(enabled) {
  const [live, setLive] = useState({});
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;
    let es = null;
    let tree = null;
    let retryTimer = null;
    let delay = 1000;
    let stopped = false;

    const handle = (merge) => (ev) => {
      try {
        const { path, data } = JSON.parse(ev.data);
        tree = applyAt(tree, path, data, merge);
        setLive(deriveLive(tree));
        setConnected(true);
        delay = 1000;
      } catch {}
    };

    const open = () => {
      if (stopped) return;
      es = new EventSource(toUrl("/"));
      es.addEventListener("put", handle(false));
      es.addEventListener("patch", handle(true));
      es.onerror = () => {
        setConnected(false);
        es?.close();
        clearTimeout(retryTimer);
        retryTimer = setTimeout(open, delay);
        delay = Math.min(delay * 2, 30000);
      };
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (!es || es.readyState === 2) {
        clearTimeout(retryTimer);
        delay = 1000;
        open();
      }
    };

    open();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      es?.close();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [enabled]);

  return { live, connected };
}

async function putBool(path, value) {
  const res = await fetch(toUrl(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(!!value),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

/** Импульс через Firebase: true → через 1 с false. */
export async function firebasePulse(path) {
  try {
    await putBool(path, true);
  } catch {
    throw new Error("Не удалось отправить сигнал. Проверьте интернет");
  }
  setTimeout(() => putBool(path, false).catch(() => {}), 1000);
}

/**
 * Статус нажатия по ключу: 'sending' | 'opened' | 'error' | undefined.
 * run(key, send) — send() это любая async-функция (Firebase или MQTT).
 */
export function usePulse() {
  const [status, setStatus] = useState({});
  const timers = useRef({});

  useEffect(() => {
    const t = timers.current;
    return () => Object.values(t).forEach(clearTimeout);
  }, []);

  const setFor = useCallback((key, value, resetMs) => {
    setStatus((s) => ({ ...s, [key]: value }));
    clearTimeout(timers.current[key]);
    if (resetMs) {
      timers.current[key] = setTimeout(
        () => setStatus((s) => ({ ...s, [key]: undefined })),
        resetMs,
      );
    }
  }, []);

  const run = useCallback(
    async (key, send) => {
      setFor(key, "sending");
      try {
        await send();
        setFor(key, "opened", 3000);
        return { ok: true };
      } catch (e) {
        setFor(key, "error", 2500);
        return { ok: false, error: e?.message || "Не удалось отправить сигнал" };
      }
    },
    [setFor],
  );

  return { status, run };
}
