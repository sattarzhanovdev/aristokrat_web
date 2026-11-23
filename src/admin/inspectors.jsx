import React, { useCallback, useEffect, useState } from "react";
import {
  LuBanknote,
  LuCalendarClock,
  LuCar,
  LuCircleCheck,
  LuHash,
  LuLock,
  LuPhone,
  LuPlus,
  LuSquareParking,
  LuTrash2,
  LuTriangleAlert,
  LuUser,
} from "react-icons/lu";
import {
  adminCancelInvoice,
  adminDeleteInvoice,
  adminInvoice,
  adminMarkPaid,
  adminResident,
  adminUpdateInvoice,
  adminUpdateResident,
  dueText,
  fmtDate,
  fmtDateTime,
  METHOD_LABEL,
  money,
} from "../api/billing";
import { useToast } from "../components/ui/Toast";
import { useAdmin } from "./AdminApp";
import {
  Button,
  Confirm,
  Field,
  Group,
  Inspector,
  Modal,
  Row,
  Segmented,
  SkeletonRows,
  StatusBadge,
  Switch,
  Tag,
  aptLabel,
  cx,
  isService,
  placeLabel,
  userName,
} from "./kit";
import s from "./admin.module.scss";

function useLoad(fn, id) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      setData(await fn(id));
    } catch (e) {
      setError(e.message);
    }
  }, [fn, id]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);
  return { data, setData, error, load };
}

const isoPlus = (iso, days) => {
  const d = iso ? new Date(`${iso}T00:00:00`) : new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE");
};
const todayIso = () => new Date().toLocaleDateString("sv-SE");

/* =========================================================
   СЧЁТ
   ========================================================= */

export function InvoiceInspector({ id, onClose, onOpenResident }) {
  const toast = useToast();
  const { refresh } = useAdmin();
  const { data: inv, setData, error } = useLoad(adminInvoice, id);
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState(null); // 'paid' | 'extend' | 'cancel' | 'delete'
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [newDue, setNewDue] = useState("");

  const run = async (key, fn, ok) => {
    setBusy(key);
    try {
      const updated = await fn();
      setData(updated);
      refresh();
      setDialog(null);
      if (ok) toast(ok);
    } catch (e) {
      toast(e.message, "error", 3500);
    } finally {
      setBusy("");
    }
  };

  const open = inv?.status === "issued";
  const st = inv?.display_status;
  const cur = inv?.currency;

  return (
    <>
      <Inspector
        open={!!id}
        onClose={onClose}
        title={inv ? inv.title : "Счёт"}
        subtitle={
          inv && (
            <>
              <span>{inv.number}</span>
              {inv.period && <span>· {inv.period}</span>}
              <StatusBadge status={st} />
            </>
          )
        }
        footer={
          open && (
            <>
              <Button kind="filled" size="lg" icon={LuBanknote} onClick={() => { setMethod("cash"); setNote(""); setDialog("paid"); }}>
                Отметить оплату
              </Button>
              <Button kind="tinted" size="lg" icon={LuCalendarClock} onClick={() => { setNewDue(isoPlus(inv.due_date < todayIso() ? todayIso() : inv.due_date, 7)); setDialog("extend"); }}>
                Продлить
              </Button>
            </>
          )
        }
      >
        {error ? (
          <div className={s.errorBox}>{error}</div>
        ) : !inv ? (
          <SkeletonRows n={5} />
        ) : (
          <>
            <div className={s.hero}>
              <span className={s.heroAmount}>{money(inv.amount, cur)}</span>
              <span className={s.muted}>
                {open
                  ? `Оплатить до ${fmtDate(inv.due_date)} · ${dueText(inv.due_date)}`
                  : inv.status === "paid"
                    ? `Оплачен ${fmtDateTime(inv.paid_at)}`
                    : `Отменён ${fmtDateTime(inv.cancelled_at)}`}
              </span>
            </div>

            {st === "blocking" && (
              <div className={cx(s.callout, s.callout_red)}>
                <LuLock />
                <span>
                  <b>Житель заблокирован этим счётом.</b> Доступ к паркингу закрыт, в приложении виден только экран оплаты.
                  Снять блокировку: отметить оплату, продлить срок или отменить счёт.
                </span>
              </div>
            )}
            {st === "overdue" && (
              <div className={cx(s.callout, s.callout_orange)}>
                <LuTriangleAlert />
                <span>
                  <b>Срок прошёл.</b> Блокировка для этого счёта выключена — доступ у жителя остаётся.
                </span>
              </div>
            )}
            {st === "issued" && inv.block_on_overdue && (
              <div className={cx(s.callout, s.callout_blue)}>
                <LuLock />
                <span>Если счёт не оплатят до {fmtDate(inv.due_date)} включительно, доступ к паркингу закроется автоматически.</span>
              </div>
            )}
            {st === "paid" && (
              <div className={cx(s.callout, s.callout_green)}>
                <LuCircleCheck />
                <span>Счёт оплачен. Если житель был заблокирован, доступ открылся автоматически.</span>
              </div>
            )}

            <Group label="Плательщик">
              <Row icon={LuUser} label={userName(inv.user)} onClick={() => onOpenResident(inv.user.id)} chevron>
                {aptLabel(inv.user)}
              </Row>
              {inv.user.phone && (
                <Row icon={LuPhone} label="Телефон">
                  <a href={`tel:${inv.user.phone}`}>{inv.user.phone}</a>
                </Row>
              )}
            </Group>

            <Group
              label="Условия"
              footer={open ? "Изменение применяется сразу. Если галочку снять у просроченного счёта, житель будет разблокирован." : undefined}
            >
              <Switch
                checked={inv.block_on_overdue}
                disabled={!open || busy === "flag"}
                onChange={(v) =>
                  run("flag", () => adminUpdateInvoice(inv.id, { block_on_overdue: v }), v ? "Блокировка при неуплате включена" : "Блокировка при неуплате выключена")
                }
                label="Блокировать при неуплате"
              />
              <Row label="Срок оплаты">{fmtDate(inv.due_date)}</Row>
              <Row label="Выставлен">{fmtDateTime(inv.created_at)}{inv.created_by_name ? ` · ${inv.created_by_name}` : ""}</Row>
            </Group>

            {inv.description && (
              <Group label="Комментарий">
                <div className={s.row} style={{ color: "var(--a-label)" }}>{inv.description}</div>
              </Group>
            )}

            <Group label="Платежи">
              {!inv.payments?.length ? (
                <div className={cx(s.row, s.muted)}>Платежей пока нет</div>
              ) : (
                inv.payments.map((p) => (
                  <Row key={p.id} label={`${METHOD_LABEL[p.method]}${p.note ? ` · ${p.note}` : ""}`}>
                    <Tag tone={p.status === "succeeded" ? "green" : p.status === "failed" ? "gray" : "blue"}>
                      {p.status === "succeeded" ? "Прошёл" : p.status === "failed" ? "Не прошёл" : "В процессе"}
                    </Tag>{" "}
                    {fmtDateTime(p.completed_at || p.created_at)}
                  </Row>
                ))
              )}
            </Group>

            <div style={{ display: "flex", gap: 8 }}>
              {open && (
                <Button kind="destructive" onClick={() => setDialog("cancel")} style={{ flex: 1 }}>
                  Отменить счёт
                </Button>
              )}
              {inv.status !== "paid" && (
                <Button kind="destructive" icon={LuTrash2} onClick={() => setDialog("delete")} style={{ flex: 1 }}>
                  Удалить
                </Button>
              )}
            </div>
          </>
        )}
      </Inspector>

      <Modal
        open={dialog === "paid"}
        onClose={() => setDialog(null)}
        title="Отметить оплату"
        action={
          <Button
            kind="filled"
            size="sm"
            busy={busy === "paid"}
            onClick={() => run("paid", () => adminMarkPaid(inv.id, { method, note }), "Оплата отмечена — доступ открыт")}
          >
            Готово
          </Button>
        }
      >
        <p className={s.muted} style={{ margin: 0 }}>
          {inv && `${inv.title} · ${money(inv.amount, cur)} · ${userName(inv.user)}`}
        </p>
        <Field label="Как оплатили">
          <Segmented
            full
            value={method}
            onChange={setMethod}
            options={[
              { value: "cash", label: "Наличными" },
              { value: "transfer", label: "Переводом" },
            ]}
          />
        </Field>
        <Field label="Комментарий" hint="Например, номер квитанции">
          <input className={s.input} value={note} onChange={(e) => setNote(e.target.value)} maxLength={255} />
        </Field>
      </Modal>

      <Modal
        open={dialog === "extend"}
        onClose={() => setDialog(null)}
        title="Продлить срок"
        action={
          <Button
            kind="filled"
            size="sm"
            busy={busy === "extend"}
            disabled={!newDue || newDue < todayIso()}
            onClick={() => run("extend", () => adminUpdateInvoice(inv.id, { due_date: newDue }), `Срок продлён до ${fmtDate(newDue)}`)}
          >
            Сохранить
          </Button>
        }
      >
        <Field label="Новый срок оплаты" hint={newDue ? `${fmtDate(newDue)} · ${dueText(newDue)}` : ""}>
          <input type="date" className={s.input} min={todayIso()} value={newDue} onChange={(e) => setNewDue(e.target.value)} />
        </Field>
        <div className={s.presets}>
          {[3, 7, 14, 30].map((d) => (
            <button key={d} type="button" className={s.preset} onClick={() => setNewDue(isoPlus(todayIso(), d))}>
              +{d} дн.
            </button>
          ))}
        </div>
        {st === "blocking" && (
          <div className={cx(s.callout, s.callout_blue)} style={{ margin: 0 }}>
            <LuLock />
            <span>После продления житель сразу будет разблокирован до нового срока.</span>
          </div>
        )}
      </Modal>

      <Confirm
        open={dialog === "delete"}
        onClose={() => setDialog(null)}
        title={`Удалить счёт ${inv?.number || ""}?`}
        message="Счёт исчезнет совсем — и у вас, и у жителя, без следа в истории. Если он блокировал доступ, блокировка снимется. Восстановить нельзя."
        confirmLabel="Удалить"
        danger
        busy={busy === "delete"}
        onConfirm={async () => {
          setBusy("delete");
          try {
            await adminDeleteInvoice(inv.id);
            setDialog(null);
            refresh();
            onClose();
            toast(`Счёт ${inv.number} удалён`);
          } catch (e) {
            setDialog(null);
            toast(e.message, "error", 4000);
          } finally {
            setBusy("");
          }
        }}
      />

      <Confirm
        open={dialog === "cancel"}
        onClose={() => setDialog(null)}
        title={`Отменить счёт ${inv?.number || ""}?`}
        message="Житель больше не увидит этот счёт, а если счёт блокировал доступ — блокировка снимется. Действие нельзя отменить."
        confirmLabel="Отменить счёт"
        danger
        busy={busy === "cancel"}
        onConfirm={() => run("cancel", () => adminCancelInvoice(inv.id), "Счёт отменён")}
      />
    </>
  );
}

/* =========================================================
   ЖИТЕЛЬ
   ========================================================= */

export function ResidentInspector({ id, onClose, onOpenInvoice }) {
  const toast = useToast();
  const { refresh, openComposer, version } = useAdmin();
  const { data, setData, error, load } = useLoad(adminResident, id);
  const [busy, setBusy] = useState("");

  // счёт выставили/оплатили в другом окне — обновимся
  useEffect(() => {
    if (id) load();
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (key, body, ok) => {
    setBusy(key);
    try {
      setData(await adminUpdateResident(id, body));
      refresh();
      toast(ok);
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy("");
    }
  };

  const r = data?.resident;
  const st = data?.state;

  return (
    <Inspector
      open={!!id}
      onClose={onClose}
      title={r ? userName(r) : "Житель"}
      subtitle={
        r && (
          <>
            {placeLabel(r) && <span>{placeLabel(r)}</span>}
            {r.is_service && <Tag tone="indigo">Служебный</Tag>}
            {r.blocked && <Tag tone="red" icon={LuLock}>Заблокирован</Tag>}
            {!r.blocked && r.overdue && <Tag tone="orange">Долг</Tag>}
            {r.has_parking && <Tag tone="blue" icon={LuSquareParking}>Паркинг</Tag>}
            {!r.is_active && <Tag tone="gray">Отключён</Tag>}
          </>
        )
      }
      footer={
        r && (
          <Button kind="filled" size="lg" icon={LuPlus} onClick={() => openComposer({ users: [r] })}>
            Выставить счёт
          </Button>
        )
      }
    >
      {error ? (
        <div className={s.errorBox}>{error}</div>
      ) : !r ? (
        <SkeletonRows n={5} />
      ) : (
        <>
          <div className={s.hero}>
            <span className={s.muted}>Задолженность</span>
            <span className={cx(s.heroAmount, Number(st.outstanding) > 0 && st.overdue_count > 0 && s.danger)}>
              {money(st.outstanding, st.currency)}
            </span>
            <span className={s.muted}>
              {st.open_count === 0
                ? "Неоплаченных счетов нет"
                : `${st.open_count} неоплач. · ближайший срок ${fmtDate(st.next_due)}`}
            </span>
          </div>

          {r.blocked && (
            <div className={cx(s.callout, s.callout_red)}>
              <LuLock />
              <span>
                <b>Доступ к паркингу закрыт за неуплату.</b> Откроется автоматически после оплаты всех блокирующих счетов.
              </span>
            </div>
          )}

          <Group label="Доступ">
            <Switch
              checked={r.has_parking}
              disabled={busy === "parking"}
              onChange={(v) => patch("parking", { has_parking: v }, v ? "Доступ к паркингу выдан" : "Доступ к паркингу закрыт")}
              label="Паркинг"
              hint="Кнопки шлагбаума и ворот в приложении"
            />
            <Switch
              checked={r.is_active}
              disabled={busy === "active"}
              onChange={(v) => patch("active", { is_active: v }, v ? "Аккаунт включён" : "Аккаунт отключён")}
              label="Аккаунт активен"
              hint="Отключённый житель не сможет войти в приложение"
            />
          </Group>

          <Group label="Контакты">
            <Row icon={LuUser} label="Логин">{r.login}</Row>
            <Row icon={LuPhone} label="Телефон">
              {r.phone ? <a href={`tel:${r.phone}`}>{r.phone}</a> : "—"}
            </Row>
            <Row icon={LuHash} label="Квартира">{isService(r) ? "служебный" : r.apartment_no || "—"}{r.entrance_no ? `, подъезд ${r.entrance_no}` : ""}</Row>
            <Row icon={LuCar} label="Автомобиль">{data.resident.car_number || "—"}</Row>
          </Group>

          <Group label="Счета">
            {data.invoices.length === 0 ? (
              <div className={cx(s.row, s.muted)}>Счетов пока не было</div>
            ) : (
              data.invoices.map((inv) => (
                <button key={inv.id} type="button" className={s.listItem} onClick={() => onOpenInvoice(inv.id)} style={{ padding: "10px 16px" }}>
                  <span className={s.listMain}>
                    <span className={s.listTitle}>{inv.title}{inv.period ? ` · ${inv.period}` : ""}</span>
                    <span className={s.listSub}>
                      {inv.status === "issued" ? `до ${fmtDate(inv.due_date)}` : inv.status === "paid" ? `оплачен ${fmtDate(inv.paid_at)}` : "отменён"}
                    </span>
                  </span>
                  <span className={s.listEnd}>
                    <b>{money(inv.amount, inv.currency)}</b>
                    <StatusBadge status={inv.display_status} />
                  </span>
                </button>
              ))
            )}
          </Group>
        </>
      )}
    </Inspector>
  );
}
