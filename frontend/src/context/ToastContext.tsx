import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Toast } from "../components/shared/Toast";

export type ToastVariant = "success" | "warning" | "error" | "info";

interface ToastState {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  showToast: (
    variant: ToastVariant,
    message: string,
    durationMsOrOptions?: number | ToastOptions,
    options?: ToastOptions,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (
      variant: ToastVariant,
      message: string,
      durationMsOrOptions?: number | ToastOptions,
      options?: ToastOptions,
    ) => {
      let durationMs = 3000;
      let opts: ToastOptions | undefined;
      if (typeof durationMsOrOptions === "number") {
        durationMs = durationMsOrOptions;
        opts = options;
      } else if (durationMsOrOptions) {
        opts = durationMsOrOptions;
      }
      if (opts?.actionLabel) durationMs = Math.max(durationMs, 5000);
      setToast({
        id: ++nextId,
        variant,
        message,
        durationMs,
        actionLabel: opts?.actionLabel,
        onAction: opts?.onAction,
      });
    },
    [],
  );

  const handleDismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          key={toast.id}
          variant={toast.variant}
          message={toast.message}
          durationMs={toast.durationMs}
          onDismiss={handleDismiss}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
        />
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
