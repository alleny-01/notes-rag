import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { Check, X } from "lucide-react";

type Toast = {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
};
type ToastContextValue = {
  showToast: (message: string, tone?: Toast["tone"]) => void;
};
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) =>
      setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const showToast = useCallback(
    (message: string, tone: Toast["tone"] = "success") => {
      const id = Date.now() + Math.round(Math.random() * 1000);
      setToasts((items) => [...items.slice(-3), { id, message, tone }]);
      window.setTimeout(() => dismiss(id), 4_000);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[120] flex flex-col items-end gap-2 sm:left-auto sm:w-[22rem]"
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              role="status"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className={`pointer-events-auto flex w-full items-center gap-2 bg-[var(--cream)] px-3 py-2.5 text-[12px] shadow-[0_14px_34px_rgba(66,47,39,0.16)] ${toast.tone === "error" ? "text-[var(--signal)]" : "text-[var(--body)]"}`}
            >
              <Check
                size={14}
                className={
                  toast.tone === "error" ? "hidden" : "text-[var(--purple)]"
                }
                strokeWidth={1.5}
              />
              <span className="min-w-0 flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="grid size-6 place-items-center rounded text-[var(--muted)] transition hover:bg-[var(--paper)] hover:text-[var(--ink)]"
                aria-label="Dismiss notification"
              >
                <X size={14} strokeWidth={1} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider.");
  return context;
}
