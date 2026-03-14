import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { Toast } from "../components/shared/Toast";

export type ToastVariant = "success" | "warning" | "error";

interface ToastState {
  id: number;
  variant: ToastVariant;
  message: string;
  durationMs: number;
}

interface ToastContextValue {
  showToast: (
    variant: ToastVariant,
    message: string,
    durationMs?: number,
  ) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback(
    (variant: ToastVariant, message: string, durationMs = 3000) => {
      setToast({ id: ++nextId, variant, message, durationMs });
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
