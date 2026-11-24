import React, { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LuLock, LuPlus, LuRefreshCw, LuSquareParking, LuUsers } from "react-icons/lu";
import { adminResidents, money, pluralize } from "../../api/billing";
import { useAdmin } from "../AdminApp";
import { Avatar, Button, Empty, Search, Segmented, SkeletonRows, Tag, placeLabel, cx, userName } from "../kit";
import { useDebounced, usePaged } from "./usePaged";
import s from "../admin.module.scss";

const FILTERS = [
  { value: "all", label: "Все" },
  { value: "unpaid", label: "Есть счета" },
  { value: "debtors", label: "Должники" },
  { value: "blocked", label: "Заблокированы" },
  { value: "parking", label: "С паркингом" },
];

export default function Residents() {
  const { openComposer, openResident, residentId, version, overview } = useAdmin();
  const [params, setParams] = useSearchParams();
  const filter = params.get("filter") || "all";
  const [q, setQ] = useState("");
  const search = useDebounced(q.trim());
  const [picked, setPicked] = useState({}); // id -> resident (для массового счёта)

  const setFilter = (v) =>
    setParams((p) => {
      const n = new URLSearchParams(p);
      n.set("filter", v);
      return n;
    });

  const { items, count, next, loading, more, error, reload, loadMore } = usePaged(
    adminResidents,
    { filter, q: search, ordering: filter === "debtors" || filter === "unpaid" ? "debt" : "" },
    [version],
  );

  const pickedList = Object.values(picked);
  const toggle = (r) =>
    setPicked((p) => {
      const n = { ...p };
      if (n[r.id]) delete n[r.id];
      else n[r.id] = r;
      return n;
    });
  const allOnPage = items.length > 0 && items.every((r) => picked[r.id]);
  const toggleAll = () =>
    setPicked((p) => {
      const n = { ...p };
      items.forEach((r) => (allOnPage ? delete n[r.id] : (n[r.id] = r)));
      return n;
    });

  const options = FILTERS.map((o) => ({
    ...o,
    count: o.value === "blocked" ? overview?.blocked_residents : o.value === "debtors" ? overview?.debtors : 0,
    alert: o.value === "blocked",
  }));

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <div>
          <h1 className={s.largeTitle}>Жители</h1>
          <p className={s.subtitle}>
            {loading ? "Загрузка…" : `${count} ${pluralize(count, ["житель", "жителя", "жителей"])}`}
          </p>
        </div>
        <div className={s.toolbarActions}>
          {pickedList.length > 0 && (
            <Button kind="gray" onClick={() => setPicked({})}>
              Снять выбор
            </Button>
          )}
          <Button kind="filled" icon={LuPlus} onClick={() => openComposer(pickedList.length ? { users: pickedList } : {})}>
            {pickedList.length ? `Счёт для ${pickedList.length}` : "Выставить счёт"}
          </Button>
        </div>
      </div>

      <div className={s.filters}>
        <Segmented value={filter} onChange={setFilter} options={options} ariaLabel="Фильтр" />
        <Search value={q} onChange={setQ} placeholder="Имя, квартира, телефон, авто" />
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
            icon={LuUsers}
            title="Никого не нашли"
            text={filter === "blocked" ? "Заблокированных за неуплату нет." : "Измените фильтр или запрос."}
          />
        ) : (
          <>
            <table className={s.table}>
              <thead>
                <tr>
                  <th style={{ width: 36 }} onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className={s.check} checked={allOnPage} onChange={toggleAll} aria-label="Выбрать всех на странице" />
                  </th>
                  <th>Житель</th>
                  <th className={s.hideSm}>Телефон</th>
                  <th>Статус</th>
                  <th className={s.num}>Долг</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} onClick={() => openResident(r.id)} className={cx(residentId === r.id && s.trSelected)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className={s.check}
                        checked={!!picked[r.id]}
                        onChange={() => toggle(r)}
                        aria-label={`Выбрать ${userName(r)}`}
                      />
                    </td>
                    <td>
                      <div className={s.cell}>
                        <span className={s.hideSm}>
                          <Avatar user={r} />
                        </span>
                        <span className={s.cellText}>
                          <span className={s.cellMain}>{userName(r)}</span>
                          <span className={s.cellSub}>
                            {placeLabel(r) || r.login}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className={cx(s.hideSm, s.mono)}>{r.phone || "—"}</td>
                    <td>
                      <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
                        {r.blocked ? (
                          <Tag tone="red" icon={LuLock}>Заблокирован</Tag>
                        ) : r.overdue ? (
                          <Tag tone="orange">Долг</Tag>
                        ) : r.open_count > 0 ? (
                          <Tag tone="blue">Ждёт оплаты</Tag>
                        ) : null}
                        {r.has_parking && (
                          <span className={s.hideSm}>
                            <Tag tone="gray" icon={LuSquareParking}>Паркинг</Tag>
                          </span>
                        )}
                        {r.is_service && <Tag tone="indigo">Служебный</Tag>}
                        {!r.is_active && <Tag tone="gray">Отключён</Tag>}
                      </span>
                    </td>
                    <td className={cx(s.num, Number(r.outstanding) > 0 && r.overdue && s.danger)}>
                      {Number(r.outstanding) > 0 ? money(r.outstanding, overview?.currency) : <span className={s.muted}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={s.tableFoot}>
              <span>
                Показано {items.length} из {count}
                {pickedList.length > 0 && ` · выбрано ${pickedList.length}`}
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
