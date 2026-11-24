import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LuLock, LuPlus, LuReceipt, LuRefreshCw } from "react-icons/lu";
import { adminInvoices, dueText, fmtDate, money } from "../../api/billing";
import { useAdmin } from "../AdminApp";
import { Avatar, Button, Empty, Search, Segmented, SkeletonRows, StatusBadge, aptLabel, cx, userName } from "../kit";
import { useDebounced, usePaged } from "./usePaged";
import { BatchHeader, BatchList } from "./Batches";
import s from "../admin.module.scss";

const STATUSES = [
  { value: "unpaid", label: "Не оплачены" },
  { value: "overdue", label: "Просрочены" },
  { value: "blocking", label: "Блокируют" },
  { value: "paid", label: "Оплачены" },
  { value: "cancelled", label: "Отменены" },
  { value: "all", label: "Все" },
];

/**
 * «Счета»: по умолчанию — выставления (каждая рассылка одной строкой с итогами),
 * внутри выставления — его счета; «Все счета» — общий список по жителям.
 */
export default function Invoices() {
  const { openComposer } = useAdmin();
  const [params, setParams] = useSearchParams();
  const batch = params.get("batch");
  // ссылки с обзора (?status=overdue) ведут сразу в общий список
  const view = params.get("view") || (params.get("status") ? "list" : "batches");

  const go = (patch) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
      return n;
    });

  if (batch) {
    return (
      <div className={s.page}>
        <BatchHeader batch={batch} onBack={() => go({ batch: null, status: null, view: "batches" })} />
        <InvoiceList batch={batch} defaultStatus="all" />
      </div>
    );
  }

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <div>
          <h1 className={s.largeTitle}>Счета</h1>
          <div style={{ marginTop: 10 }}>
            <Segmented
              value={view}
              onChange={(v) => go({ view: v, status: null })}
              ariaLabel="Вид"
              options={[
                { value: "batches", label: "Выставления" },
                { value: "list", label: "Все счета" },
              ]}
            />
          </div>
        </div>
        <div className={s.toolbarActions}>
          <Button kind="filled" icon={LuPlus} onClick={() => openComposer()}>
            Выставить счёт
          </Button>
        </div>
      </div>
      {view === "batches" ? <BatchList onOpen={(id) => go({ batch: id, status: null })} /> : <InvoiceList />}
    </div>
  );
}

function InvoiceList({ batch, defaultStatus = "unpaid" }) {
  const { openComposer, openInvoice, invoiceId, version, overview } = useAdmin();
  const [params, setParams] = useSearchParams();
  const status = params.get("status") || defaultStatus;
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());

  const setStatus = (v) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("status", v);
      return n;
    });

  const { items, count, next, loading, more, error, reload, loadMore } = usePaged(
    adminInvoices,
    { status, q: search, batch, ordering: status === "paid" || status === "cancelled" ? "" : "due" },
    [version],
  );

  const options = STATUSES.map((o) => ({
    ...o,
    count: o.value === "overdue" ? overview?.overdue_count : 0,
    alert: o.value === "overdue",
  }));

  return (
    <>
      <div className={s.filters}>
        <Segmented value={status} onChange={setStatus} options={options} ariaLabel="Статус" />
        <Search value={q} onChange={setQ} placeholder="Житель, квартира, № счёта" />
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
          <SkeletonRows n={8} />
        ) : items.length === 0 ? (
          <Empty
            icon={LuReceipt}
            title={search ? "Ничего не найдено" : "Счетов нет"}
            text={search ? "Попробуйте другой запрос." : "Здесь появятся счета с выбранным статусом."}
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
                  <th>Житель</th>
                  <th className={s.hideSm}>Назначение</th>
                  <th className={s.hideSm}>Срок</th>
                  <th>Статус</th>
                  <th className={s.num}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {items.map((inv) => (
                  <tr key={inv.id} onClick={() => openInvoice(inv.id)} className={cx(invoiceId === inv.id && s.trSelected)}>
                    <td>
                      <div className={s.cell}>
                        <span className={s.hideSm}>
                          <Avatar user={inv.user} />
                        </span>
                        <span className={s.cellText}>
                          <span className={s.cellMain}>{userName(inv.user)}</span>
                          <span className={s.cellSub}>
                            {[aptLabel(inv.user), inv.number].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className={s.hideSm}>
                      <span className={s.cellText}>
                        <span className={s.cellMain} style={{ fontWeight: 500 }}>{inv.title}</span>
                        {inv.period && <span className={s.cellSub}>{inv.period}</span>}
                      </span>
                    </td>
                    <td className={s.hideSm}>
                      <span className={s.cellText}>
                        <span style={{ whiteSpace: "nowrap" }}>
                          {fmtDate(inv.due_date)}
                          {inv.block_on_overdue && inv.status === "issued" && (
                            <LuLock title="Блокировать при неуплате" style={{ marginLeft: 6, verticalAlign: -2, color: "var(--a-label-2)" }} />
                          )}
                        </span>
                        {inv.status === "issued" && (
                          <span className={cx(s.cellSub, inv.is_overdue && s.warnText)}>{dueText(inv.due_date)}</span>
                        )}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={inv.display_status} />
                    </td>
                    <td className={s.num}>
                      <b style={{ fontWeight: 600 }}>{money(inv.amount, inv.currency)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={s.tableFoot}>
              <span>
                Показано {items.length} из {count}
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
