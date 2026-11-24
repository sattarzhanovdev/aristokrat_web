import React, { useEffect, useMemo, useState } from "react";
import { LuX } from "react-icons/lu";
import { adminCreateInvoices, adminResidents, currentPeriod, fmtDate, money, pluralize } from "../api/billing";
import { useToast } from "../components/ui/Toast";
import { useAdmin } from "./AdminApp";
import { Avatar, Button, Field, Group, Modal, Search, Segmented, Switch, aptLabel, cx, placeLabel, userName } from "./kit";
import s from "./admin.module.scss";

const TITLES = ["Паркинг", "Обслуживание ЖК", "Охрана", "Ремонт"];

const isoPlus = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("sv-SE"); // YYYY-MM-DD в локальной зоне
};

const blank = () => ({
  recipients: "users",
  users: [],
  title: "Паркинг",
  period: currentPeriod(),
  amount: "",
  due_date: isoPlus(10),
  block_on_overdue: true,
  description: "",
});

function RecipientPicker({ users, onChange }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const page = await adminResidents({ q: q.trim(), page_size: 30 });
        if (alive) setFound(page.results || []);
      } catch {
        if (alive) setFound([]);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q]);

  const ids = new Set(users.map((u) => u.id));
  const toggle = (u) => onChange(ids.has(u.id) ? users.filter((x) => x.id !== u.id) : [...users, u]);

  return (
    <div className={s.pickBox}>
      {users.length > 0 && (
        <div className={s.pickChips}>
          {users.map((u) => (
            <span key={u.id} className={s.pickChip}>
              {userName(u)} {aptLabel(u) && `· ${aptLabel(u)}`}
              <button type="button" onClick={() => toggle(u)} aria-label={`Убрать ${userName(u)}`}>
                <LuX />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={s.pickSearch}>
        <Search value={q} onChange={setQ} placeholder="Имя, квартира, телефон или номер авто" />
      </div>
      <div className={s.pickList}>
        {loading && found.length === 0 ? (
          <div className={cx(s.pickItem, s.muted)}>Ищем…</div>
        ) : found.length === 0 ? (
          <div className={cx(s.pickItem, s.muted)}>Никого не нашли</div>
        ) : (
          found.map((u) => (
            <label key={u.id} className={s.pickItem}>
              <input type="checkbox" className={s.check} checked={ids.has(u.id)} onChange={() => toggle(u)} />
              <Avatar user={u} />
              <span className={s.listMain}>
                <span className={s.listTitle}>{userName(u)}</span>
                <span className={s.listSub}>
                  {[placeLabel(u), u.has_parking && "паркинг", u.phone].filter(Boolean).join(" · ") || u.login}
                </span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}

export default function NewInvoice({ open, preset, onClose, onCreated }) {
  const toast = useToast();
  const { overview } = useAdmin();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    const b = blank();
    if (preset?.users?.length) b.users = preset.users;
    if (preset?.recipients) b.recipients = preset.recipients;
    setF(b);
    setErrors({});
  }, [open, preset]);

  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const count = useMemo(() => {
    if (f.recipients === "users") return f.users.length;
    if (f.recipients === "parking") return overview?.parking_total ?? null;
    return overview?.approved_total ?? null;
  }, [f.recipients, f.users, overview]);

  const amount = Number(String(f.amount).replace(",", ".").replace(/\s/g, ""));
  const total = count && amount > 0 ? count * amount : 0;
  const currency = overview?.currency || "KGS";

  const submit = async () => {
    const e = {};
    if (f.recipients === "users" && f.users.length === 0) e.users = "Выберите хотя бы одного жителя";
    if (!f.title.trim()) e.title = "Укажите назначение";
    if (!(amount > 0)) e.amount = "Укажите сумму";
    if (!f.due_date) e.due_date = "Укажите срок";
    setErrors(e);
    if (Object.keys(e).length) return;

    setBusy(true);
    try {
      const res = await adminCreateInvoices({
        recipients: f.recipients,
        user_ids: f.users.map((u) => u.id),
        title: f.title.trim(),
        period: f.period.trim(),
        amount: amount.toFixed(2),
        due_date: f.due_date,
        block_on_overdue: f.block_on_overdue,
        description: f.description.trim(),
      });
      const word = pluralize(res.created, ["счёт", "счёта", "счетов"]);
      toast(
        res.skipped
          ? `Выставлено ${res.created} ${word}, ${res.skipped} пропущено — за этот период уже есть`
          : `Выставлено ${res.created} ${word}`,
        "success",
        3500,
      );
      onCreated?.(res);
    } catch (err) {
      toast(err.message, "error", 3500);
    } finally {
      setBusy(false);
    }
  };

  const recipientsWord =
    count === null ? "…" : `${count} ${pluralize(count || 0, ["житель", "жителя", "жителей"])}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Новый счёт"
      wide
      action={
        <Button kind="filled" size="sm" onClick={submit} busy={busy}>
          Выставить
        </Button>
      }
    >
      <Field label="Кому">
        <Segmented
          full
          value={f.recipients}
          onChange={set("recipients")}
          ariaLabel="Получатели"
          options={[
            { value: "users", label: "Выбранным" },
            { value: "parking", label: "Всем с паркингом" },
            { value: "all", label: "Всем жителям" },
          ]}
        />
      </Field>

      {f.recipients === "users" ? (
        <Field error={errors.users}>
          <RecipientPicker users={f.users} onChange={set("users")} />
        </Field>
      ) : (
        <div className={s.groupFoot} style={{ padding: 0, marginTop: -8 }}>
          {f.recipients === "parking"
            ? `Счёт получат все активные жители с доступом к паркингу — ${recipientsWord}.`
            : `Счёт получат все подтверждённые жители — ${recipientsWord}.`}
        </div>
      )}

      <div className={s.formGrid}>
        <Field label="Назначение" error={errors.title}>
          <input className={s.input} value={f.title} onChange={(e) => set("title")(e.target.value)} maxLength={160} />
          <div className={s.presets}>
            {TITLES.map((t) => (
              <button
                key={t}
                type="button"
                className={cx(s.preset, f.title === t && s.presetActive)}
                onClick={() => set("title")(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Период" hint="Повторно за тот же период счёт не выставится">
          <input className={s.input} value={f.period} onChange={(e) => set("period")(e.target.value)} maxLength={40} placeholder="Декабрь 2026" />
        </Field>
        <Field label="Сумма" error={errors.amount}>
          <input
            className={cx(s.input, s.inputMoney)}
            inputMode="decimal"
            placeholder="0"
            value={f.amount}
            onChange={(e) => set("amount")(e.target.value.replace(/[^\d.,\s]/g, ""))}
          />
        </Field>
        <Field label="Оплатить до" error={errors.due_date} hint={f.due_date ? fmtDate(f.due_date) : ""}>
          <input
            type="date"
            className={cx(s.input, s.inputMoney)}
            style={{ fontSize: 17 }}
            min={isoPlus(0)}
            value={f.due_date}
            onChange={(e) => set("due_date")(e.target.value)}
          />
        </Field>
        <Field label="Комментарий для жителя" className={s.span2}>
          <textarea
            className={s.textarea}
            rows={2}
            value={f.description}
            onChange={(e) => set("description")(e.target.value)}
            placeholder="Необязательно"
          />
        </Field>
      </div>

      <Group
        footer={
          f.block_on_overdue
            ? `Если счёт не оплатят до ${fmtDate(f.due_date)} включительно, на следующий день житель увидит только экран оплаты, а паркинг станет недоступен. После оплаты доступ откроется автоматически.`
            : "Просроченный счёт будет подсвечен, но доступ к паркингу останется."
        }
      >
        <Switch
          checked={f.block_on_overdue}
          onChange={set("block_on_overdue")}
          label="Блокировать при неуплате"
          hint="Закрыть доступ к паркингу, если срок оплаты прошёл"
        />
      </Group>

      <div className={s.summaryBar}>
        <span>
          {count === null ? "…" : `${count} ${pluralize(count || 0, ["счёт", "счёта", "счетов"])}`}
          {amount > 0 && count > 1 ? ` × ${money(amount, currency)}` : ""}
        </span>
        <b>{money(total, currency)}</b>
      </div>
    </Modal>
  );
}
