import React, { useCallback, useEffect, useRef, useState } from "react";
import { LuSearch, LuLock, LuLockOpen, LuCircleCheck, LuCircleX, LuRefreshCw, LuPhone, LuUser } from "react-icons/lu";
import { getApartments, getApartment, setApartmentBlocked, setApartmentApproval } from "../../api";
import Sheet, { ConfirmSheet } from "../../components/ui/Sheet";
import { useToast } from "../../components/ui/Toast";
import { haptic } from "../../lib/native";
import ui from "../../components/ui/ui.module.scss";
import c from "./admin.module.scss";

const ENTRANCES = ["all", "1", "2", "3", "4", "5", "6", "7", "8"];

const isBlocked = (a) => !!a && (a.is_blocked === true || a.status === "Заблокирована");

export default function Admin() {
  const toast = useToast();
  const [entrance, setEntrance] = useState("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const [items, setItems] = useState([]);
  const [next, setNext] = useState(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState("");
  const reqId = useRef(0);

  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null); // 'block' | 'reject'

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    setErr("");
    try {
      const page = await getApartments({ entrance, search });
      if (id !== reqId.current) return;
      setItems(page.items);
      setNext(page.next);
      setCount(page.count);
    } catch (e) {
      if (id === reqId.current) setErr(e.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [entrance, search]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = async () => {
    if (!next) return;
    setLoadingMore(true);
    try {
      const page = await getApartments({ url: next });
      setItems((prev) => [...prev, ...page.items]);
      setNext(page.next);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const open = async (ap) => {
    haptic.tap();
    setSelected(ap);
    setDetailLoading(true);
    try {
      setSelected(await getApartment(ap.id));
    } catch {
      /* показываем то, что есть в списке */
    } finally {
      setDetailLoading(false);
    }
  };

  const patchInList = (updated) =>
    setItems((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const doApproval = async (accept) => {
    if (!selected) return;
    setBusy(accept ? "accept" : "reject");
    try {
      await setApartmentApproval(selected.id, accept);
      haptic.success();
      toast(accept ? `Кв. ${selected.number} подтверждена` : `Кв. ${selected.number} отклонена`);
      setConfirm(null);
    } catch (e) {
      haptic.error();
      toast(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const doBlock = async () => {
    if (!selected) return;
    const block = !isBlocked(selected);
    setBusy("block");
    try {
      const updated = await setApartmentBlocked(selected.id, block);
      setSelected(updated);
      patchInList(updated);
      haptic.success();
      toast(block ? `Кв. ${selected.number} заблокирована` : `Кв. ${selected.number} разблокирована`);
      setConfirm(null);
    } catch (e) {
      haptic.error();
      toast(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const blocked = isBlocked(selected);

  return (
    <div className={c.page}>
      <div className={c.searchBox}>
        <LuSearch className={c.searchIcon} />
        <input
          type="search"
          inputMode="numeric"
          enterKeyHint="search"
          placeholder="Номер квартиры"
          aria-label="Поиск по номеру квартиры"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className={c.chips} role="tablist" aria-label="Подъезд">
        {ENTRANCES.map((e) => (
          <button
            key={e}
            role="tab"
            aria-selected={entrance === e}
            className={`${c.chip} ${entrance === e ? c.chipActive : ""}`}
            onClick={() => {
              haptic.tap();
              setEntrance(e);
            }}
          >
            {e === "all" ? "Все" : `Подъезд ${e}`}
          </button>
        ))}
      </div>

      <div className={c.meta}>
        {loading ? "Загрузка…" : err ? "" : `Найдено: ${count}`}
      </div>

      {err ? (
        <div className={c.state}>
          <p>{err}</p>
          <button className={`${ui.btn} ${ui.btnGhost}`} onClick={load}>
            <LuRefreshCw /> Повторить
          </button>
        </div>
      ) : loading ? (
        <div className={c.grid}>
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={c.skeleton} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={c.state}>
          <p>Ничего не найдено</p>
        </div>
      ) : (
        <>
          <div className={c.grid}>
            {items.map((ap) => (
              <button
                key={ap.id}
                className={`${c.apt} ${isBlocked(ap) ? c.aptBlocked : ""}`}
                onClick={() => open(ap)}
              >
                <span className={c.aptNo}>{ap.number}</span>
                <span className={c.aptSub}>
                  {isBlocked(ap) ? (
                    <>
                      <LuLock /> Блок
                    </>
                  ) : ap.entrance ? (
                    `Подъезд ${ap.entrance}`
                  ) : (
                    "Активна"
                  )}
                </span>
              </button>
            ))}
          </div>
          {next && (
            <button className={`${ui.btn} ${ui.btnGhost}`} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? <span className={ui.spinner} /> : "Показать ещё"}
            </button>
          )}
        </>
      )}

      <Sheet
        open={!!selected && !confirm}
        onClose={() => setSelected(null)}
        title={selected ? `Квартира №${selected.number}` : ""}
      >
        {selected && (
          <>
            <span className={`${c.status} ${blocked ? c.statusBad : c.statusOk}`}>
              {blocked ? <LuLock /> : <LuCircleCheck />}
              {blocked ? "Заблокирована" : "Активна"}
            </span>

            <div className={c.info}>
              <div className={c.infoRow}>
                <LuUser />
                <span>Владелец</span>
                <b>{detailLoading ? "…" : selected.owner_name || "—"}</b>
              </div>
              <div className={c.infoRow}>
                <LuPhone />
                <span>Телефон</span>
                {selected.phone ? (
                  <a href={`tel:${selected.phone}`}>{selected.phone}</a>
                ) : (
                  <b>{detailLoading ? "…" : "—"}</b>
                )}
              </div>
            </div>

            <div className={c.sectionLabel}>Доступ жильцов</div>
            <div className={c.actions2}>
              <button
                className={`${ui.btn} ${c.btnAccept}`}
                onClick={() => doApproval(true)}
                disabled={!!busy}
              >
                {busy === "accept" ? <span className={ui.spinner} /> : <><LuCircleCheck /> Принять</>}
              </button>
              <button
                className={`${ui.btn} ${c.btnReject}`}
                onClick={() => setConfirm("reject")}
                disabled={!!busy}
              >
                <LuCircleX /> Отклонить
              </button>
            </div>

            <button
              className={`${ui.btn} ${blocked ? ui.btnPrimary : c.btnBlock}`}
              onClick={() => (blocked ? doBlock() : setConfirm("block"))}
              disabled={!!busy}
            >
              {busy === "block" ? (
                <span className={ui.spinner} />
              ) : blocked ? (
                <><LuLockOpen /> Разблокировать</>
              ) : (
                <><LuLock /> Заблокировать</>
              )}
            </button>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirm === "block"}
        title={`Заблокировать кв. ${selected?.number}?`}
        message="Жильцы этой квартиры не смогут открывать двери, пока вы не разблокируете её."
        confirmLabel="Заблокировать"
        danger
        busy={busy === "block"}
        onConfirm={doBlock}
        onClose={() => setConfirm(null)}
      />
      <ConfirmSheet
        open={confirm === "reject"}
        title={`Отклонить кв. ${selected?.number}?`}
        message="Профили жильцов этой квартиры потеряют подтверждение."
        confirmLabel="Отклонить"
        danger
        busy={busy === "reject"}
        onConfirm={() => doApproval(false)}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
