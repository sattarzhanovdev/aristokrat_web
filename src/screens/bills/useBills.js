import { useCallback, useEffect, useRef, useState } from "react";
import { getMyBilling, getMyPayment, startPayment } from "../../api/billing";
import { useAuth } from "../../auth/AuthProvider";
import { isNative } from "../../lib/native";

const PENDING_KEY = "pendingPayment";

const store = {
  get: () => {
    try {
      return Number(localStorage.getItem(PENDING_KEY)) || null;
    } catch {
      return null;
    }
  },
  set: (id) => {
    try {
      if (id) localStorage.setItem(PENDING_KEY, String(id));
      else localStorage.removeItem(PENDING_KEY);
    } catch {}
  },
};

/**
 * Счета жителя + весь цикл оплаты:
 * pay() → страница платёжной системы → возврат (?payment=ID или возврат в приложение)
 * → опрос статуса → обновление блокировки без перезахода.
 */
export function useBills({ onPaid } = {}) {
  const { applyBilling, revalidate } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(null); // id счёта, по которому идёт переход к оплате
  const [checking, setChecking] = useState(false);
  const onPaidRef = useRef(onPaid);
  onPaidRef.current = onPaid;

  const load = useCallback(
    async ({ silent = false, retried = false } = {}) => {
      if (!silent) setLoading(true);
      try {
        const d = await getMyBilling();
        setData(d);
        setError("");
        applyBilling(d.state);
        return d;
      } catch (e) {
        // старая сессия без токена: тихо перелогиниваемся и пробуем ещё раз
        if (e.status === 401 && !retried) {
          await revalidate({ force: true });
          return load({ silent, retried: true });
        }
        if (!silent) setError(e.message);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [applyBilling, revalidate],
  );

  /** Опрашиваем платёж, пока провайдер не сообщит результат (до ~40 с). */
  const watchPayment = useCallback(
    async (paymentId) => {
      setChecking(true);
      try {
        for (let i = 0; i < 20; i++) {
          let p;
          try {
            p = await getMyPayment(paymentId);
          } catch (e) {
            if (e.status === 404) break;
            throw e;
          }
          if (p.status !== "pending") {
            store.set(null);
            applyBilling(p.state);
            await load({ silent: true });
            if (p.status === "succeeded") onPaidRef.current?.(p);
            return p.status;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        return "pending";
      } finally {
        setChecking(false);
      }
    },
    [applyBilling, load],
  );

  // первая загрузка + возврат со страницы оплаты
  useEffect(() => {
    load();
    const url = new URL(window.location.href);
    const fromUrl = Number(url.searchParams.get("payment")) || null;
    if (fromUrl) {
      url.searchParams.delete("payment");
      url.searchParams.delete("result");
      window.history.replaceState(null, "", url.pathname + url.search);
    }
    const pending = fromUrl || store.get();
    if (pending) watchPayment(pending);
  }, [load, watchPayment]);

  // вернулись в приложение из браузера оплаты — сразу проверяем
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const pending = store.get();
      if (pending) watchPayment(pending);
      else load({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, watchPayment]);

  const pay = useCallback(async (invoice) => {
    setPaying(invoice.id);
    try {
      const returnUrl = isNative ? undefined : `${window.location.origin}/bills`;
      const { payment_id, checkout_url } = await startPayment(invoice.id, returnUrl);
      store.set(payment_id);
      if (isNative) {
        // нативное приложение откроет внешнюю ссылку в системном браузере
        window.open(checkout_url, "_blank");
        setPaying(null);
      } else {
        window.location.assign(checkout_url);
      }
    } catch (e) {
      setPaying(null);
      throw e;
    }
  }, []);

  return { data, loading, error, reload: load, pay, paying, checking };
}
