import React from "react";
import { useNavigate } from "react-router-dom";
import { LuBanknote, LuCircleAlert, LuLock, LuPlus, LuReceipt, LuWallet } from "react-icons/lu";
import { dueText, fmtDateTime, METHOD_LABEL, money, pluralize } from "../../api/billing";
import { useAdmin } from "../AdminApp";
import { Avatar, Button, Empty, SkeletonRows, aptLabel, cx, userName } from "../kit";
import s from "../admin.module.scss";

const monthShort = (iso) => {
  const m = new Date(`${iso}T00:00:00`).toLocaleDateString("ru-RU", { month: "short" }).replace(".", "");
  return m[0].toUpperCase() + m.slice(1);
};

function compact(n) {
  const v = Number(n);
  if (v >= 1e6) return `${(v / 1e6).toFixed(1).replace(".0", "")} млн`;
  if (v >= 1e4) return `${Math.round(v / 1e3)} тыс`;
  return new Intl.NumberFormat("ru-RU").format(v);
}

export default function Overview() {
  const { overview: o, openComposer, openInvoice } = useAdmin();
  const nav = useNavigate();

  const greeting = new Date().toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" });
  const max = Math.max(1, ...(o?.months || []).map((m) => Number(m.total)));

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <div>
          <h1 className={s.largeTitle}>Обзор</h1>
          <p className={s.subtitle}>{greeting[0].toUpperCase() + greeting.slice(1)}</p>
        </div>
        <div className={s.toolbarActions}>
          <Button kind="filled" icon={LuPlus} onClick={() => openComposer()}>
            Выставить счёт
          </Button>
        </div>
      </div>

      {!o ? (
        <div className={s.card}>
          <SkeletonRows n={6} />
        </div>
      ) : (
        <>
          <div className={s.kpiGrid}>
            <button type="button" className={s.kpi} onClick={() => nav("/admin/invoices?status=unpaid")}>
              <span className={s.kpiLabel}>
                <LuWallet /> К получению
              </span>
              <span className={s.kpiValue}>{money(o.outstanding, o.currency)}</span>
              <span className={s.kpiSub}>
                {o.open_count} {pluralize(o.open_count, ["счёт", "счёта", "счетов"])} не оплачено
              </span>
            </button>
            <button type="button" className={s.kpi} onClick={() => nav("/admin/payments")}>
              <span className={s.kpiLabel}>
                <LuBanknote /> Собрано в этом месяце
              </span>
              <span className={s.kpiValue}>{money(o.collected_month, o.currency)}</span>
              <span className={s.kpiSub}>
                {o.paid_month_count} {pluralize(o.paid_month_count, ["платёж", "платежа", "платежей"])}
              </span>
            </button>
            <button
              type="button"
              className={cx(s.kpi, o.overdue_count > 0 && s.kpiWarn)}
              onClick={() => nav("/admin/invoices?status=overdue")}
            >
              <span className={s.kpiLabel}>
                <LuCircleAlert /> Просрочено
              </span>
              <span className={s.kpiValue}>{o.overdue_count}</span>
              <span className={s.kpiSub}>
                {o.debtors} {pluralize(o.debtors, ["должник", "должника", "должников"])}
              </span>
            </button>
            <button
              type="button"
              className={cx(s.kpi, o.blocked_residents > 0 && s.kpiAlert)}
              onClick={() => nav("/admin/residents?filter=blocked")}
            >
              <span className={s.kpiLabel}>
                <LuLock /> Заблокировано
              </span>
              <span className={s.kpiValue}>{o.blocked_residents}</span>
              <span className={s.kpiSub}>доступ к паркингу закрыт</span>
            </button>
          </div>

          <div className={s.twoCol}>
            <section className={s.card}>
              <div className={s.cardHead}>
                <h2 className={s.cardTitle}>Поступления</h2>
                <span className={s.muted} style={{ fontSize: 13 }}>последние 6 месяцев</span>
              </div>
              <div className={s.chart} role="img" aria-label="Поступления по месяцам">
                {o.months.map((m, i) => (
                  <div key={m.month} className={cx(s.bar, i === o.months.length - 1 && s.barCurrent)}>
                    <span className={s.barValue}>{Number(m.total) ? compact(m.total) : ""}</span>
                    <span className={s.barFill} style={{ height: `${(Number(m.total) / max) * 100}%` }} />
                    <span className={s.barLabel}>{monthShort(m.month)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className={s.card}>
              <div className={s.cardHead}>
                <h2 className={s.cardTitle}>Срок в ближайшие 7 дней</h2>
              </div>
              {o.due_soon.length === 0 ? (
                <Empty icon={LuReceipt} title="Ничего не горит" text="Нет счетов со сроком на этой неделе." />
              ) : (
                <div className={s.list}>
                  {o.due_soon.map((inv) => (
                    <button key={inv.id} type="button" className={s.listItem} onClick={() => openInvoice(inv.id)}>
                      <Avatar user={inv.user} />
                      <span className={s.listMain}>
                        <span className={s.listTitle}>{userName(inv.user)}</span>
                        <span className={s.listSub}>
                          {[aptLabel(inv.user), inv.title].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className={s.listEnd}>
                        <b>{money(inv.amount, inv.currency)}</b>
                        <span className={inv.block_on_overdue ? s.warnText : undefined}>
                          {inv.block_on_overdue && <LuLock style={{ verticalAlign: -1, marginRight: 3 }} />}
                          {dueText(inv.due_date)}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.cardTitle}>Последние оплаты</h2>
              <Button kind="plain" size="sm" onClick={() => nav("/admin/payments")}>
                Все платежи
              </Button>
            </div>
            {o.recent_payments.length === 0 ? (
              <Empty
                icon={LuBanknote}
                title="Оплат пока нет"
                text="Когда жители начнут оплачивать счета, они появятся здесь."
              />
            ) : (
              <div className={s.list}>
                {o.recent_payments.map((p) => (
                  <button key={p.id} type="button" className={s.listItem} onClick={() => openInvoice(p.invoice)}>
                    <Avatar user={p.user} />
                    <span className={s.listMain}>
                      <span className={s.listTitle}>{userName(p.user)}</span>
                      <span className={s.listSub}>
                        {[aptLabel(p.user), p.invoice_title, METHOD_LABEL[p.method]].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className={s.listEnd}>
                      <b>+{money(p.amount, o.currency)}</b>
                      <span>{fmtDateTime(p.completed_at)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {!o.online_payment?.enabled && (
            <p className={s.muted} style={{ fontSize: 13, textAlign: "center", marginTop: 20 }}>
              Онлайн-оплата не подключена — жители видят счета, а оплату отмечаете вы.{" "}
              <a href="/admin/settings" onClick={(e) => { e.preventDefault(); nav("/admin/settings"); }} style={{ color: "var(--a-blue-text)" }}>
                Подробнее
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
