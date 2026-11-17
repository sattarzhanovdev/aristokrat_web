import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import { LuCheck, LuCircleAlert, LuInfo } from "react-icons/lu";
import c from "./ui.module.scss";

const ToastContext = createContext(() => {});

const ICONS = { success: LuCheck, error: LuCircleAlert, info: LuInfo };

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const show = useCallback((message, type = "success", ms = 2200) => {
    clearTimeout(timer.current);
    setToast({ message, type, id: Date.now() });
    timer.current = setTimeout(() => setToast(null), ms);
  }, []);

  const Icon = toast ? ICONS[toast.type] || LuInfo : null;

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={c.toastHost} aria-live="polite">
        {toast && (
          <div key={toast.id} className={`${c.toast} ${c[`toast_${toast.type}`]}`} role="status">
            <Icon className={c.toastIcon} />
            <span>{toast.message}</span>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
