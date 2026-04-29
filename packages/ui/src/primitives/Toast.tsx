import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Alert, Check, Close } from "../icons/index.tsx";

export type ToastTone = "info" | "success" | "warn" | "error";

export interface ToastSpec {
  id: string;
  tone: ToastTone;
  message: ReactNode;
  durationMs?: number;
}

interface ToastCtx {
  push: (spec: Omit<ToastSpec, "id">) => string;
  dismiss: (id: string) => void;
}

const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children?: ReactNode }) {
  const [toasts, setToasts] = useState<ToastSpec[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (spec: Omit<ToastSpec, "id">) => {
      const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const full: ToastSpec = { id, durationMs: 4000, ...spec };
      setToasts((prev) => [...prev, full]);
      if (full.durationMs && full.durationMs > 0) {
        setTimeout(() => dismiss(id), full.durationMs);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="toast-stack">
            {toasts.map((t) => (
              <ToastView key={t.id} toast={t} onClose={() => dismiss(t.id)} />
            ))}
          </div>,
          document.body,
        )}
    </Ctx.Provider>
  );
}

function ToastView({ toast, onClose }: { toast: ToastSpec; onClose: () => void }) {
  const Icon = toast.tone === "success" ? Check : Alert;
  return (
    <div className={`toast toast-${toast.tone}`} role="status">
      <Icon size={16} />
      <span className="toast-msg">{toast.message}</span>
      <button type="button" aria-label="Dismiss" onClick={onClose} className="toast-close">
        <Close size={14} />
      </button>
    </div>
  );
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Allow calls when provider not mounted (e.g., during dev preview).
    return {
      push: () => "",
      dismiss: () => {},
    };
  }
  return ctx;
}

