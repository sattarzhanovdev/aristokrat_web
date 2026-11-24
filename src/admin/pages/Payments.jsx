import React, { useState } from "react";
import { LuBanknote, LuRefreshCw } from "react-icons/lu";
import { adminPayments, fmtDateTime, METHOD_LABEL, money, pluralize } from "../../api/billing";
import { useAdmin } from "../AdminApp";
import { Avatar, Button, Empty, Search, Segmented, SkeletonRows, Tag, placeLabel, cx, userName } from "../kit";
import { useDebounced, usePaged } from "./usePaged";
import s from "../admin.module.scss";

const STATUS_TONE = { succeeded: ["green", "Прошёл"], pending: ["blue", "В процессе"], failed: ["gray", "Не прошёл"] };

export default function Payments() {
  const { openInvoice, version, overview } = useAdmin();
  const [status, setStatus] = useState("succeeded");
  const [method, setMethod] = useState("all");
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());

  const { items, count, next, loading, more, error, reload, loadMore } = usePaged(
    adminPayments,
    { status, method, q: search },
    [version],
  );

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <div>
          <h1 className={s.largeTitle}>Платежи</h1>
          <p className={s.subtitle}>
            {loading ? "Загрузка…" : `${count} ${pluralize(count, ["платёж", "платежа", "платежей"])}`}
          </p>
        </div>
      </div>

      <div className={s.filters}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Segmented
            value={status}
            onChange={setStatus}
            ariaLabel="Статус"
            options={[
              { value: "succeeded", label: "Прошли" },
              { value: "pending", label: "В процессе" },
              { value: "failed", label: "Не прошли" },
            ]}
          />
          <Segmented
            value={method}
            onChange={setMethod}
            ariaLabel="Способ"
            options={[
              { value: "all", label: "Все способы" },
              { value: "online", label: "Онлайн" },
              { value: "cash", label: "Наличные" },
              { value: "transfer", label: "Перевод" },
            ]}
          />
        </div>
        <Search value={q} onChange={setQ} placeholder="Житель или квартира" />
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
          <Empty icon={LuBanknote} title="Платежей нет" text="Здесь появятся оплаты жителей и отметки об оплате." />
        ) : (
          <>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Житель</th>
                  <th className={s.hideSm}>Счёт</th>
                  <th className={s.hideSm}>Способ</th>
                  <th>Дата</th>
                  <th className={s.num}>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => {
                  const [tone, label] = STATUS_TONE[p.status];
                  return (
                    <tr key={p.id} onClick={() => openInvoice(p.invoice)}>
                      <td>
                        <div className={s.cell}>
                          <span className={s.hideSm}>
                            <Avatar user={p.user} />
                          </span>
                          <span className={s.cellText}>
                            <span className={s.cellMain}>{userName(p.user)}</span>
                            <span className={s.cellSub}>{placeLabel(p.user) || p.user?.login}</span>
                          </span>
                        </div>
                      </td>
                      <td className={s.hideSm}>
                        <span className={s.cellText}>
                          <span className={s.cellMain} style={{ fontWeight: 500 }}>{p.invoice_title}</span>
                          <span className={s.cellSub}>{p.invoice_number}</span>
                        </span>
                      </td>
                      <td className={s.hideSm}>
                        <span className={s.cellText}>
                          <span>{METHOD_LABEL[p.method]}</span>
                          {p.recorded_by_name && <span className={s.cellSub}>отметил {p.recorded_by_name}</span>}
                        </span>
                      </td>
                      <td>
                        <span className={s.cellText}>
                          <span style={{ whiteSpace: "nowrap" }}>{fmtDateTime(p.completed_at || p.created_at)}</span>
                          {status !== "succeeded" && (
                            <span>
                              <Tag tone={tone}>{label}</Tag>
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={cx(s.num)}>
                        <b style={{ fontWeight: 600 }}>
                          {p.status === "succeeded" ? "+" : ""}
                          {money(p.amount, overview?.currency)}
                        </b>
                      </td>
                    </tr>
                  );
                })}
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
    </div>
  );
}
