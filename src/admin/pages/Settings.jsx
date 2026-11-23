import React, { useEffect, useState } from "react";
import { LuCircleCheck, LuCreditCard, LuFlaskConical, LuInfo, LuLock, LuTrash2 } from "react-icons/lu";
import { adminDeleteTestPayments, adminSettings, adminTestPayments, pluralize } from "../../api/billing";
import { useAdmin } from "../AdminApp";
import { Button, Confirm, Group, Row, SkeletonRows, Tag, cx } from "../kit";
import s from "../admin.module.scss";

export default function Settings() {
  const [d, setD] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminSettings().then(setD).catch((e) => setError(e.message));
  }, []);

  const provider = d?.online_payment;
  const isDemo = d?.provider_code === "demo";

  return (
    <div className={s.page} style={{ maxWidth: 720 }}>
      <div className={s.toolbar}>
        <h1 className={s.largeTitle}>Настройки</h1>
      </div>

      {error ? (
        <div className={s.errorBox}>{error}</div>
      ) : !d ? (
        <div className={s.card}>
          <SkeletonRows n={4} />
        </div>
      ) : (
        <>
          <Group
            label="Онлайн-оплата"
            footer={
              provider.enabled
                ? d.provider_code === "demo"
                  ? "Тестовый режим: житель «оплачивает» на тестовой странице, деньги не списываются. Не включайте на рабочем сервере."
                  : "Жители оплачивают счета в приложении, доступ открывается автоматически."
                : "Сейчас жители видят счета, а оплату вы отмечаете вручную. Чтобы включить онлайн-оплату, нужен договор с платёжной системой — её подключают на сервере (BILLING_PROVIDER)."
            }
          >
            <Row icon={LuCreditCard} label="Платёжная система">
              {provider.enabled ? (
                <Tag tone={d.provider_code === "demo" ? "orange" : "green"} icon={LuCircleCheck}>
                  {provider.title}
                </Tag>
              ) : (
                <Tag tone="gray">Не подключена</Tag>
              )}
            </Row>
            <Row label="Валюта счетов">
              {d.currency_label} ({d.currency})
            </Row>
            <Row label="Возврат после оплаты">{d.return_url}</Row>
            <Row label="Телефон для жителей">{d.support_phone || "—"}</Row>
          </Group>

          <TestPayments isDemo={isDemo} />

          <Group label="Как работает блокировка">
            <div className={s.row} style={{ alignItems: "flex-start" }}>
              <LuLock className={s.rowIcon} style={{ marginTop: 2 }} />
              <span className={cx(s.rowLabel)} style={{ lineHeight: "20px" }}>
                Если у счёта включено «Блокировать при неуплате» и срок прошёл, житель на следующий день видит в
                приложении только счета к оплате, а паркинг недоступен.
              </span>
            </div>
            <div className={s.row} style={{ alignItems: "flex-start" }}>
              <LuCircleCheck className={s.rowIcon} style={{ marginTop: 2, color: "var(--a-green)" }} />
              <span className={s.rowLabel} style={{ lineHeight: "20px" }}>
                Доступ открывается сам, как только все блокирующие счета оплачены. Вы также можете отметить оплату
                вручную, продлить срок или отменить счёт.
              </span>
            </div>
            <div className={s.row} style={{ alignItems: "flex-start" }}>
              <LuInfo className={s.rowIcon} style={{ marginTop: 2 }} />
              <span className={s.rowLabel} style={{ lineHeight: "20px" }}>
                Администраторов блокировка не касается.
              </span>
            </div>
          </Group>
        </>
      )}
    </div>
  );
}

/** Тестовые оплаты (с демо-страницы): показываем, только если они есть или включён тестовый режим. */
function TestPayments({ isDemo }) {
  const { refresh } = useAdmin();
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    adminTestPayments().then(setStats).catch(() => setStats(null));
  }, []);

  if (!stats || (!stats.payments && !isDemo && !done)) return null;

  const n = stats.payments;
  const footer =
    done ||
    (n
      ? "Удаляются только оплаты, сделанные на тестовой странице. Счета, закрытые такой оплатой, снова станут неоплаченными — и снова будут блокировать, если срок прошёл. Отметки «наличными» и «переводом» не трогаются."
      : "Тестовых оплат нет.");

  return (
    <Group label="Тестовые оплаты" footer={footer}>
      <Row icon={LuFlaskConical} label="Оплачено на тестовой странице">
        {n ? `${n} ${pluralize(n, ["оплата", "оплаты", "оплат"])}` : "нет"}
      </Row>
      {n > 0 && (
        <div className={s.row}>
          <Button kind="destructive" icon={LuTrash2} onClick={() => { setError(""); setOpen(true); }}>
            Удалить тестовые оплаты
          </Button>
        </div>
      )}
      <Confirm
        open={open}
        onClose={() => !busy && setOpen(false)}
        title={`Удалить ${n} ${pluralize(n, ["тестовую оплату", "тестовые оплаты", "тестовых оплат"])}?`}
        message={
          error ||
          `${stats.invoices ? `${stats.invoices} ${pluralize(stats.invoices, ["счёт снова станет", "счёта снова станут", "счетов снова станут"])} неоплаченными. ` : ""}Восстановить нельзя.`
        }
        confirmLabel="Удалить"
        danger
        busy={busy}
        onConfirm={async () => {
          setBusy(true);
          try {
            const r = await adminDeleteTestPayments();
            setStats(r);
            setDone(
              `Удалено: ${r.deleted}. ${r.reopened ? `Снова ждут оплаты: ${r.reopened} ${pluralize(r.reopened, ["счёт", "счёта", "счетов"])}.` : ""}`.trim(),
            );
            setOpen(false);
            refresh?.();
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </Group>
  );
}
