import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const ToastContext = createContext(() => {});
const SHOW_MS = 5000;
const LEAVE_MS = 320; // must match the toast-out animation in app.css

// Short messages in the top-right corner, e.g. "Saved." or an error.
// They slide in from the right and slide back out when closed.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const drop = useCallback((id) => {
    setToasts((all) => all.filter((t) => t.id !== id));
    delete timers.current[id];
  }, []);

  const remove = useCallback((id) => {
    setToasts((all) => all.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  }, []);

  const push = useCallback(
    (message, type = "success") => {
      const id = Math.random().toString(36).slice(2);
      setToasts((all) => {
        // Same message again: replace the old one. Never more than 3 on screen.
        const kept = all.filter((t) => t.leaving || t.message !== message);
        const visible = kept.filter((t) => !t.leaving);
        const extra = new Set(visible.slice(0, Math.max(0, visible.length - 2)).map((t) => t.id));
        return [...kept.map((t) => (extra.has(t.id) ? { ...t, leaving: true } : t)), { id, message, type }];
      });
      timers.current[id] = setTimeout(() => remove(id), SHOW_MS);
    },
    [remove]
  );

  // Toasts marked "leaving" (e.g. pushed out by a 4th one) are removed after their slide-out.
  useEffect(() => {
    toasts.forEach((t) => {
      if (t.leaving && !timers.current[`out-${t.id}`]) {
        clearTimeout(timers.current[t.id]);
        timers.current[`out-${t.id}`] = setTimeout(() => { drop(t.id); delete timers.current[`out-${t.id}`]; }, LEAVE_MS);
      }
    });
  }, [toasts, drop]);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast${t.type === "error" ? " toast-error" : ""}${t.leaving ? " is-leaving" : ""}`}>
            <span className="toast-icon"><Icon name={t.type === "error" ? "x" : "check"} /></span>
            <span className="toast-text">{t.message}</span>
            <button type="button" onClick={() => remove(t.id)} aria-label="Close message"><Icon name="x" /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
