/**
 * Компоненты админ-панели — реализация DESIGN.md (раздел 6).
 */
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LuCircleCheck, LuClock, LuLock, LuSearch, LuX, LuCircleSlash, LuTriangleAlert } from "react-icons/lu";
import { STATUS_LABEL } from "../api/billing";
import s from "./admin.module.scss";

export const cx = (...a) => a.filter(Boolean).join(" ");

export function Button({ kind = "tinted", size, icon: Icon, children, busy, className, ...rest }) {
  return (
    <button
      type="button"
      className={cx(s.btn, s[`btn_${kind}`], size && s[`btn_${size}`], className)}
      disabled={busy || rest.disabled}
      {...rest}
    >
      {busy ? <span className={s.spin} /> : Icon && <Icon className={s.btnIcon} />}
      {children && <span>{children}</span>}
    </button>
  );
}

export function Segmented({ value, onChange, options, ariaLabel, full }) {
  return (
    <div className={cx(s.segmented, full && s.segmentedFull)} role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={cx(s.segment, value === o.value && s.segmentActive)}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count > 0 && <span className={cx(s.segCount, o.alert && s.segCountAlert)}>{o.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Search({ value, onChange, placeholder = "Поиск", autoFocus }) {
  return (
    <label className={s.search}>
      <LuSearch className={s.searchIcon} />
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button type="button" className={s.searchClear} onClick={() => onChange("")} aria-label="Очистить">
          <LuX />
        </button>
      )}
    </label>
  );
}

export function Switch({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cx(s.switchRow, disabled && s.disabled)}>
      <span className={s.switchText}>
        <span className={s.switchLabel}>{label}</span>
        {hint && <span className={s.switchHint}>{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={s.switch}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

const STATUS_ICON = {
  issued: LuClock,
  overdue: LuTriangleAlert,
  blocking: LuLock,
  paid: LuCircleCheck,
  cancelled: LuCircleSlash,
};

export function StatusBadge({ status, children }) {
  const Icon = STATUS_ICON[status];
  return (
    <span className={cx(s.badge, s[`badge_${status}`])}>
      {Icon && <Icon />}
      {children || STATUS_LABEL[status]}
    </span>
  );
}

export function Tag({ tone = "gray", icon: Icon, children }) {
  return (
    <span className={cx(s.badge, s[`tone_${tone}`])}>
      {Icon && <Icon />}
      {children}
    </span>
  );
}

function useEscape(open, onClose) {
  const lastFocus = useRef(null);
  useEffect(() => {
    if (!open) return;
    lastFocus.current = document.activeElement;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus?.();
    };
  }, [open, onClose]);
}

/** Модальный лист по центру (macOS sheet). Кнопки — в шапке. */
export function Modal({ open, onClose, title, cancelLabel = "Отмена", action, children, wide }) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={cx(s.portal, s.modalBackdrop)} onMouseDown={onClose}>
      <div
        className={cx(s.modal, wide && s.modalWide)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={s.modalHead}>
          <button type="button" className={s.modalCancel} onClick={onClose}>
            {cancelLabel}
          </button>
          <h2 className={s.modalTitle}>{title}</h2>
          <div className={s.modalAction}>{action}</div>
        </header>
        <div className={s.modalBody}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/** Инспектор справа (десктоп) / шторка снизу (телефон). */
export function Inspector({ open, onClose, title, subtitle, children, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={cx(s.portal, s.inspectorBackdrop)} onMouseDown={onClose}>
      <aside
        className={s.inspector}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={s.inspectorHead}>
          <div className={s.inspectorTitles}>
            <h2 className={s.inspectorTitle}>{title}</h2>
            {subtitle && <div className={s.inspectorSub}>{subtitle}</div>}
          </div>
          <button type="button" className={s.iconBtn} onClick={onClose} aria-label="Закрыть">
            <LuX />
          </button>
        </header>
        <div className={s.inspectorBody}>{children}</div>
        {footer && <footer className={s.inspectorFoot}>{footer}</footer>}
      </aside>
    </div>,
    document.body,
  );
}

/** Подтверждение опасного действия (alert в стиле macOS). */
export function Confirm({ open, onClose, title, message, confirmLabel, danger, busy, onConfirm }) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className={cx(s.portal, s.modalBackdrop)} onMouseDown={onClose}>
      <div className={s.alert} role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className={s.alertTitle}>{title}</h3>
        {message && <p className={s.alertText}>{message}</p>}
        <div className={s.alertActions}>
          <Button kind="gray" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button kind={danger ? "destructiveFilled" : "filled"} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Group({ label, footer, children }) {
  return (
    <section className={s.groupWrap}>
      {label && <div className={s.groupLabel}>{label}</div>}
      <div className={s.group}>{children}</div>
      {footer && <div className={s.groupFoot}>{footer}</div>}
    </section>
  );
}

export function Row({ label, children, icon: Icon, onClick, chevron }) {
  const El = onClick ? "button" : "div";
  return (
    <El type={onClick ? "button" : undefined} className={cx(s.row, onClick && s.rowBtn)} onClick={onClick}>
      {Icon && <Icon className={s.rowIcon} />}
      <span className={s.rowLabel}>{label}</span>
      <span className={s.rowValue}>{children}</span>
      {chevron && <span className={s.rowChevron}>›</span>}
    </El>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx(s.field, className)}>
      {label && <span className={s.fieldLabel}>{label}</span>}
      {children}
      {error ? <span className={s.fieldError}>{error}</span> : hint && <span className={s.fieldHint}>{hint}</span>}
    </label>
  );
}

export function Empty({ icon: Icon, title, text, action }) {
  return (
    <div className={s.empty}>
      {Icon && <Icon className={s.emptyIcon} />}
      <div className={s.emptyTitle}>{title}</div>
      {text && <div className={s.emptyText}>{text}</div>}
      {action}
    </div>
  );
}

export function Avatar({ name, user }) {
  // безымянный житель: в кружке номер квартиры, служебный — значок
  let text = (name || userName(user) || "?").trim().slice(0, 1).toUpperCase();
  if (user && !user.name) text = isService(user) ? "★" : realApt(user) || text;
  return <span className={cx(s.avatar, text.length > 2 && s.avatarSm)}>{text}</span>;
}

export function SkeletonRows({ n = 6 }) {
  return (
    <div className={s.skelList}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={s.skelRow} />
      ))}
    </div>
  );
}

/** Служебные аккаунты (мусоровоз и т.п.) живут в «квартире» 10000. */
export const isService = (u) => !!u?.is_service || String(u?.apartment_no ?? "") === "10000";
const realApt = (u) => (u?.apartment_no && !isService(u) ? String(u.apartment_no) : "");

/** Имя жителя; почти у всех имя пустое, а логин вида «142-4» — показываем «Кв. 142». */
export const userName = (u) => {
  if (!u) return "—";
  if (u.name) return u.name;
  if (realApt(u)) return `Кв. ${realApt(u)}`;
  return u.login || "—";
};

/** «кв. 142» — только если квартира ещё не в имени. */
export const aptLabel = (u) => (u?.name && realApt(u) ? `кв. ${realApt(u)}` : "");

/** Полное место: «кв. 142, подъезд 4» / «подъезд 4» / «служебный». */
export const placeLabel = (u) => {
  if (!u) return "";
  if (isService(u)) return "служебный аккаунт";
  const entr = u.entrance_no ? `подъезд ${u.entrance_no}` : "";
  return [aptLabel(u), entr].filter(Boolean).join(", ");
};
