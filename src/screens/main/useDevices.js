import { useCallback, useEffect, useRef, useState } from "react";

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
