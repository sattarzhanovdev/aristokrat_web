import React, { useEffect, useState } from "react";
import {
  LuCircleCheck,
  LuClock,
  LuCreditCard,
  LuLock,
  LuLogOut,
  LuPhone,
  LuReceipt,
  LuRefreshCw,
  LuTriangleAlert,
} from "react-icons/lu";
import { useAuth } from "../../auth/AuthProvider";
import { ConfirmSheet } from "../../components/ui/Sheet";
import { useToast } from "../../components/ui/Toast";
import { haptic } from "../../lib/native";
import { dueText, fmtDate, money, STATUS_LABEL } from "../../api/billing";
import { useBills } from "./useBills";
import ui from "../../components/ui/ui.module.scss";
import c from "./bills.module.scss";

function InvoiceCard({ inv, onPay, paying, payEnabled }) {
  const st = inv.display_status;
  const open = inv.status === "issued";
  return (
    <article className={`${c.card} ${c[`card_${st}`] || ""}`}>
      <div className={c.cardTop}>
        <div className={c.cardTitle}>
          <span className={c.cardName}>{inv.title}</span>
          <span className={c.cardSub}>
            {inv.period ? `${inv.period} · ` : ""}
            {inv.number}
          </span>
        </div>
        <span className={`${c.pill} ${c[`pill_${st}`]}`}>
          {st === "blocking" && <LuLock />}
          {STATUS_LABEL[st]}
        </span>
      </div>

      <div className={c.amount}>{money(inv.amount, inv.currency)}</div>

      {inv.description && <p className={c.desc}>{inv.description}</p>}

      <div className={c.meta}>
        {open ? (
          <>
            <LuClock />
            <span>
              Оплатить до {fmtDate(inv.due_date)} · {dueText(inv.due_date)}
            </span>
          </>
        ) : inv.status === "paid" ? (
          <>
            <LuCircleCheck />
            <span>Оплачен {fmtDate(inv.paid_at)}</span>
          </>
        ) : (
          <span>Отменён администратором</span>
        )}
      </div>

      {open && inv.block_on_overdue && !inv.is_blocking && (
        <p className={c.warn}>
          <LuTriangleAlert /> Если не оплатить в срок, доступ к паркингу закроется
        </p>
      )}

      {open && payEnabled && (
        <button
          className={`${ui.btn} ${ui.btnPrimary} ${c.payBtn}`}
          onClick={() => onPay(inv)}
          disabled={!!paying}
        >
          {paying === inv.id ? (
            <span className={ui.spinner} />
          ) : (
            <>
              <LuCreditCard /> Оплатить {money(inv.amount, inv.currency)}
            </>
          )}
        </button>
      )}
    </article>
  );
}

function useBillsScreen() {
  const toast = useToast();
  const bills = useBills({
    onPaid: () => {
      haptic.success();
      toast("Оплата прошла. Спасибо!", "success", 3000);
    },
  });
  const onPay = async (inv) => {
    haptic.tap();
    try {
      await bills.pay(inv);
    } catch (e) {
      haptic.error();
      toast(e.message, "error", 3500);
    }
  };
  return { ...bills, onPay };
}

function Checking() {
  return (
    <div className={c.checking} role="status">
      <span className={ui.spinner} /> Проверяем оплату…
    </div>
  );
}

function ErrorState({ error, reload }) {
  return (
    <div className={c.state}>
      <p>{error}</p>
      <button className={`${ui.btn} ${ui.btnGhost}`} onClick={() => reload()}>
        <LuRefreshCw /> Повторить
      </button>
    </div>
  );
}

/** Вкладка «Счета» для жителя. */
export default function Bills() {
  const { data, loading, error, reload, onPay, paying, checking } = useBillsScreen();

  if (loading && !data) return <div className={c.page}><div className={c.skeleton} /><div className={c.skeleton} /></div>;
  if (error && !data) return <ErrorState error={error} reload={reload} />;

  const st = data.state;
  const payEnabled = data.online_payment?.enabled;

  return (
    <div className={c.page}>
      {checking && <Checking />}

      <section className={c.summary}>
        <span className={c.summaryLabel}>К оплате</span>
        <span className={c.summaryValue}>{money(st.outstanding, st.currency)}</span>
        <span className={c.summarySub}>
          {st.open_count === 0
            ? "Все счета оплачены"
            : st.next_due
              ? `Ближайший срок — ${fmtDate(st.next_due)}`
              : ""}
        </span>
      </section>

      {!payEnabled && st.open_count > 0 && (
        <p className={c.notice}>
          Онлайн-оплата пока не подключена — оплатите администратору ЖК, и он отметит счёт оплаченным.
        </p>
      )}

      {data.open.length > 0 && (
        <>
          <h2 className={c.h2}>Ожидают оплаты</h2>
          {data.open.map((inv) => (
            <InvoiceCard key={inv.id} inv={inv} onPay={onPay} paying={paying} payEnabled={payEnabled} />
          ))}
        </>
      )}

      {data.open.length === 0 && (
        <div className={c.empty}>
          <LuReceipt />
          <p>Новых счетов нет</p>
        </div>
      )}

      {data.history.length > 0 && (
        <>
          <h2 className={c.h2}>История</h2>
          <div className={c.history}>
            {data.history.map((inv) => (
              <div key={inv.id} className={c.hRow}>
                <div className={c.hMain}>
                  <span className={c.hTitle}>{inv.title}{inv.period ? ` · ${inv.period}` : ""}</span>
                  <span className={c.hSub}>
                    {inv.status === "paid" ? `Оплачен ${fmtDate(inv.paid_at)}` : "Отменён"} · {inv.number}
                  </span>
                </div>
                <span className={`${c.hAmount} ${inv.status === "cancelled" ? c.hStrike : ""}`}>
                  {money(inv.amount, inv.currency)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Экран блокировки: житель с просроченным «блокирующим» счётом видит
 * только счета, которые нужно оплатить. После оплаты useBills обновит
 * сводку, blocked станет false — и приложение само вернётся к паркингу.
 */
export function Blocked() {
  const { user, signOut } = useAuth();
  const { data, loading, error, reload, onPay, paying, checking } = useBillsScreen();
  const [confirm, setConfirm] = useState(false);

  // админ мог отметить оплату наличными или продлить срок — проверяем сами,
  // чтобы доступ открылся без перезахода
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") reload({ silent: true });
    }, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const payEnabled = data?.online_payment?.enabled;
  const parking = !!user?.has_parking;
  const st = data?.state || user?.billing;

  return (
    <div className={c.blockedShell}>
      <div className={c.blockedInner}>
        <div className={c.lockOrb}>
          <LuLock />
        </div>
        <h1 className={c.blockedTitle}>
          {parking ? "Доступ к паркингу приостановлен" : "Есть просроченный счёт"}
        </h1>
        <p className={c.blockedText}>
          Срок оплаты счёта истёк. Оплатите его — {parking ? "доступ" : "приложение"} откроется автоматически,
          сразу после оплаты.
        </p>

        {st && (
          <div className={c.blockedTotal}>
            <span>Итого к оплате</span>
            <b>{money(st.outstanding, st.currency)}</b>
          </div>
        )}

        {checking && <Checking />}

        {loading && !data ? (
          <div className={c.skeleton} />
        ) : error && !data ? (
          <ErrorState error={error} reload={reload} />
        ) : (
          <>
            {!payEnabled && (
              <p className={c.notice}>
                Онлайн-оплата пока не подключена — оплатите администратору ЖК, и доступ откроется после отметки.
              </p>
            )}
            {data.open.map((inv) => (
              <InvoiceCard key={inv.id} inv={inv} onPay={onPay} paying={paying} payEnabled={payEnabled} />
            ))}
          </>
        )}

        <div className={c.blockedFoot}>
          {data?.support_phone && (
            <a className={c.footLink} href={`tel:${data.support_phone}`}>
              <LuPhone /> Связаться с администрацией
            </a>
          )}
          <button className={c.footLink} onClick={() => reload()}>
            <LuRefreshCw /> Я уже оплатил — обновить
          </button>
          <button className={`${c.footLink} ${c.footMuted}`} onClick={() => setConfirm(true)}>
            <LuLogOut /> Выйти из аккаунта
          </button>
        </div>
      </div>

      <ConfirmSheet
        open={confirm}
        title="Выйти из аккаунта?"
        confirmLabel="Выйти"
        danger
        onConfirm={() => signOut()}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
