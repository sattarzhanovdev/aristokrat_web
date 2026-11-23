import React, { useCallback, useEffect, useState } from "react";
import { LuArrowLeft, LuCalendarClock, LuCircleSlash, LuLock, LuPlus, LuRefreshCw, LuSend, LuTrash2 } from "react-icons/lu";
import {
  adminBatch,
  adminBatches,
  adminCancelBatch,
  adminDeleteBatch,
  adminExtendBatch,
  dueText,
  fmtDate,
  fmtDateTime,
  money,
  pluralize,
} from "../../api/billing";
import { useToast } from "../../components/ui/Toast";
import { useAdmin } from "../AdminApp";
import { Button, Confirm, Empty, Field, Modal, Search, Segmented, SkeletonRows, Tag, cx } from "../kit";
import { useDebounced, usePaged } from "./usePaged";
import s from "../admin.module.scss";

const todayIso = () => new Date().toLocaleDateString("sv-SE");
const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("sv-SE");
};
const invoicesWord = (n) => `${n} ${pluralize(n, ["счёт", "счёта", "счетов"])}`;

/** Доля оплаченных среди неотменённых. */
function progress(b) {
  const active = b.total - b.cancelled;
  return { active, pct: active ? Math.round((b.paid / active) * 100) : 0 };
}

function Progress({ b, wide }) {
  const { active, pct } = progress(b);
  return (
    <div className={cx(s.progress, wide && s.progressWide)}>
      <div className={s.progressTrack}>
        <span className={s.progressFill} style={{ width: `${pct}%` }} />
      </div>
      <span className={s.progressText}>
        {b.paid} из {active} · {pct}%
      </span>
    </div>
  );
}

function BatchStatus({ b }) {
  if (b.open === 0) return <Tag tone={b.paid ? "green" : "gray"}>{b.paid ? "Завершено" : "Отменено"}</Tag>;
  if (b.blocking) return <Tag tone="red" icon={LuLock}>Блокирует {b.blocking}</Tag>;
  if (b.overdue) return <Tag tone="orange">Просрочено {b.overdue}</Tag>;
  return <Tag tone="blue">Ждут {b.open}</Tag>;
}

/* =========================================================
   Список выставлений
   ========================================================= */

export function BatchList({ onOpen }) {
  const { version, openComposer } = useAdmin();
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const { items, count, next, loading, more, error, reload, loadMore } = usePaged(
    adminBatches,
    { status, q: search },
    [version],
  );

  return (
    <>
      <div className={s.filters}>
        <Segmented
          value={status}
          onChange={setStatus}
          ariaLabel="Выставления"
          options={[
            { value: "active", label: "Ждут оплаты" },
            { value: "done", label: "Закрытые" },
            { value: "all", label: "Все" },
          ]}
        />
        <Search value={q} onChange={setQ} placeholder="Назначение или период" />
      </div>

      <div className={s.tableWrap}>
        {error ? (
          <div className={s.errorBox}>
            {error}
            <Button icon={LuRefreshCw} onClick={reload}>
              Повторить
            </Button>
          </div>
        ) : loading ? (
          <SkeletonRows n={6} />
        ) : items.length === 0 ? (
          <Empty
            icon={LuSend}
            title={search ? "Ничего не найдено" : status === "active" ? "Всё оплачено" : "Выставлений пока нет"}
            text={
              search
                ? "Попробуйте другой запрос."
                : "Каждый раз, когда вы выставляете счета, здесь появляется строка с итогами: сколько оплатили и сколько собрано."
            }
            action={
              !search && (
                <Button kind="tinted" icon={LuPlus} onClick={() => openComposer()}>
                  Выставить счёт
                </Button>
              )
            }
          />
        ) : (
          <>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Выставление</th>
                  <th className={s.hideSm}>Оплачено</th>
                  <th className={s.hideSm}>Срок</th>
                  <th className={s.hideSm}>Статус</th>
                  <th className={s.num}>Собрано</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.batch} onClick={() => onOpen(b.batch)}>
                    <td>
                      <span className={s.cellText}>
                        <span className={cx(s.cellMain, s.cellWide)}>
                          {b.title}
                          {b.period ? ` · ${b.period}` : ""}
                        </span>
                        <span className={cx(s.cellSub, s.showSm)} style={{ marginBottom: 2 }}>
                          <BatchStatus b={b} />
                        </span>
                        <span className={s.cellSub}>
                          {invoicesWord(b.total)} по {money(b.amount, b.currency)} · {fmtDate(b.created_at, { year: false })}
                        </span>
                      </span>
                    </td>
                    <td className={s.hideSm} style={{ minWidth: 160 }}>
                      <Progress b={b} />
                    </td>
                    <td className={s.hideSm}>
                      <span className={s.cellText}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {fmtDate(b.due_date)}
                          {b.block_on_overdue && (
                            <LuLock title="Блокировать при неуплате" style={{ marginLeft: 6, verticalAlign: -2, color: "var(--a-label-2)" }} />
                          )}
                        </span>
                        {b.open > 0 && <span className={cx(s.cellSub, b.overdue > 0 && s.warnText)}>{dueText(b.due_date)}</span>}
                      </span>
                    </td>
                    <td className={s.hideSm}>
                      <BatchStatus b={b} />
                    </td>
                    <td className={s.num}>
                      <span className={s.cellText} style={{ alignItems: "flex-end" }}>
                        <b style={{ fontWeight: 600 }}>{money(b.sum_paid, b.currency)}</b>
                        <span className={s.cellSub}>из {money(b.sum_total, b.currency)}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={s.tableFoot}>
              <span>
                {count} {pluralize(count, ["выставление", "выставления", "выставлений"])}
              </span>
              {next && (
                <Button kind="gray" size="sm" busy={more} onClick={loadMore}>
                  Показать ещё
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* =========================================================
   Шапка одного выставления: итоги + массовые действия
   ========================================================= */

export function BatchHeader({ batch, onBack }) {
  const toast = useToast();
  const { version, refresh } = useAdmin();
  const [b, setB] = useState(null);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState(null); // 'extend' | 'cancel'
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setB(await adminBatch(batch));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [batch]);

  useEffect(() => {
    load();
  }, [load, version]);

  const run = async (fn, ok) => {
    setBusy(true);
    try {
      const res = await fn();
      setB(res);
      setDialog(null);
      refresh();
      toast(typeof ok === "function" ? ok(res) : ok);
    } catch (e) {
      toast(e.message, "error", 3500);
    } finally {
      setBusy(false);
    }
  };

  if (error) return <div className={s.errorBox}>{error}</div>;

  const { active, pct } = b ? progress(b) : { active: 0, pct: 0 };

  return (
    <>
      <div className={s.toolbar}>
        <div>
          <Button kind="plain" size="sm" icon={LuArrowLeft} onClick={onBack} style={{ marginLeft: -8, marginBottom: 4 }}>
            Все выставления
          </Button>
          <h1 className={s.largeTitle}>
            {b ? `${b.title}${b.period ? ` · ${b.period}` : ""}` : "…"}
          </h1>
          {b && (
            <p className={s.subtitle}>
              Выставлено {fmtDateTime(b.created_at)}
              {b.created_by ? ` · ${b.created_by}` : ""} · {invoicesWord(b.total)} по {money(b.amount, b.currency)}
            </p>
          )}
        </div>
        {b && (
          <div className={s.toolbarActions}>
            {b.open > 0 && (
              <>
                <Button kind="tinted" icon={LuCalendarClock} onClick={() => { setDue(plusDays(7)); setDialog("extend"); }}>
                  Продлить срок
                </Button>
                <Button kind="destructive" icon={LuCircleSlash} onClick={() => setDialog("cancel")}>
                  Отменить неоплаченные
                </Button>
              </>
            )}
            {b.total > b.paid && (
              <Button kind="destructive" icon={LuTrash2} onClick={() => setDialog("delete")}>
                Удалить
              </Button>
            )}
          </div>
        )}
      </div>

      {b && (
        <div className={s.kpiGrid}>
          <div className={s.kpi}>
            <span className={s.kpiLabel}>Оплачено</span>
            <span className={s.kpiValue}>
              {b.paid} <span style={{ fontSize: 17, color: "var(--a-label-2)", fontWeight: 600 }}>из {active}</span>
            </span>
            <Progress b={b} wide />
          </div>
          <div className={s.kpi}>
            <span className={s.kpiLabel}>Собрано</span>
            <span className={s.kpiValue}>{money(b.sum_paid, b.currency)}</span>
            <span className={s.kpiSub}>
              из {money(b.sum_total, b.currency)} · {pct}%
            </span>
          </div>
          <div className={cx(s.kpi, b.overdue > 0 && s.kpiWarn)}>
            <span className={s.kpiLabel}>Срок оплаты</span>
            <span className={s.kpiValue} style={{ fontSize: 22 }}>{fmtDate(b.due_date)}</span>
            <span className={s.kpiSub}>
              {b.open > 0 ? dueText(b.due_date) : "все счета закрыты"}
              {b.block_on_overdue ? " · с блокировкой" : ""}
            </span>
          </div>
          <div className={cx(s.kpi, b.blocking > 0 && s.kpiAlert)}>
            <span className={s.kpiLabel}>
              <LuLock /> Заблокировано
            </span>
            <span className={s.kpiValue}>{b.blocking}</span>
            <span className={s.kpiSub}>
              {b.cancelled ? `отменено ${b.cancelled}` : b.block_on_overdue ? "после срока" : "блокировка выключена"}
            </span>
          </div>
        </div>
      )}

      <Modal
        open={dialog === "extend"}
        onClose={() => setDialog(null)}
        title="Продлить срок"
        action={
          <Button
            kind="filled"
            size="sm"
            busy={busy}
            disabled={!due || due < todayIso()}
            onClick={() => run(() => adminExtendBatch(batch, due), `Срок продлён до ${fmtDate(due)}`)}
          >
            Сохранить
          </Button>
        }
      >
        <p className={s.muted} style={{ margin: 0 }}>
          Новый срок получат {b?.open} неоплач. {pluralize(b?.open || 0, ["счёт", "счёта", "счетов"])}. Оплаченные не изменятся.
          {b?.blocking ? " Заблокированные жители сразу получат доступ обратно." : ""}
        </p>
        <Field label="Новый срок оплаты" hint={due ? `${fmtDate(due)} · ${dueText(due)}` : ""}>
          <input type="date" className={s.input} min={todayIso()} value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <div className={s.presets}>
          {[3, 7, 14, 30].map((d) => (
            <button key={d} type="button" className={s.preset} onClick={() => setDue(plusDays(d))}>
              +{d} дн.
            </button>
          ))}
        </div>
      </Modal>

      <Confirm
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={b?.paid ? `Удалить ${invoicesWord((b?.total || 0) - b.paid)}?` : "Удалить выставление?"}
        message={
          b?.paid
            ? `Неоплаченные и отменённые счета исчезнут у вас и у жителей. ${invoicesWord(b.paid)} уже оплачено — они останутся как запись о полученных деньгах. Восстановить нельзя.`
            : `Все ${invoicesWord(b?.total || 0)} исчезнут у вас и у жителей, блокировки по ним снимутся. Восстановить нельзя.`
        }
        confirmLabel="Удалить"
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const r = await adminDeleteBatch(batch);
            setDialog(null);
            refresh();
            const kept = [
              r.kept_paid && `${r.kept_paid} оплач. оставлено`,
              r.kept_paying && `${r.kept_paying} сейчас оплачивают — не тронуты`,
            ].filter(Boolean);
            toast(`Удалено: ${r.deleted}${kept.length ? ` · ${kept.join(", ")}` : ""}`, "success", 4000);
            if (r.remaining === 0) onBack();
            else load();
          } catch (e) {
            setDialog(null);
            toast(e.message, "error", 4000);
          } finally {
            setBusy(false);
          }
        }}
      />

      <Confirm
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title={`Отменить ${b?.open} неоплач. ${pluralize(b?.open || 0, ["счёт", "счёта", "счетов"])}?`}
        message="Оплаченные счета останутся. Жители перестанут видеть отменённые счета, блокировка по ним снимется. Действие нельзя отменить."
        confirmLabel="Отменить счета"
        danger
        busy={busy}
        onConfirm={() => run(() => adminCancelBatch(batch), (r) => `Отменено: ${r.cancelled_now}`)}
      />
    </>
  );
}
