import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import c from "./ui.module.scss";

/** Нижняя шторка в стиле iOS/Android. Закрывается тапом по фону и Esc. */
export default function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className={c.sheetBackdrop} onClick={onClose}>
      <div
        className={c.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={c.sheetGrabber} />
        {title && <h2 className={c.sheetTitle}>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Диалог подтверждения на базе шторки. */
export function ConfirmSheet({ open, title, message, confirmLabel, danger, onConfirm, onClose, busy }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {message && <p className={c.sheetText}>{message}</p>}
      <div className={c.sheetActions}>
        <button
          className={`${c.btn} ${danger ? c.btnDanger : c.btnPrimary}`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <span className={c.spinner} /> : confirmLabel}
        </button>
        <button className={`${c.btn} ${c.btnGhost}`} onClick={onClose} disabled={busy}>
          Отмена
        </button>
      </div>
    </Sheet>
  );
}
