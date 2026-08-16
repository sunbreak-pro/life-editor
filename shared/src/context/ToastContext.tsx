import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Toast,
  ToastViewport,
  type ToastVariant,
  type ToastViewportPosition,
} from "../components/Toast";
import { createContextHook } from "../hooks/createContextHook";
import { createOptionalContextHook } from "../hooks/createOptionalContextHook";

export interface ShowToastOptions {
  /**
   * Auto-dismiss delay in ms. Default 4000. Pass 0 to keep the toast up until
   * the user dismisses it.
   */
  durationMs?: number;
}

export interface ToastContextValue {
  /**
   * Enqueue a toast. `message` must be ALREADY-TRANSLATED (§6.4 — the toast
   * card is a shared primitive that never calls useTranslation; the host
   * resolves copy with its own `t` and passes it in).
   */
  showToast: (
    variant: ToastVariant,
    message: string,
    options?: ShowToastOptions,
  ) => void;
}

export const ToastContext = createContext<ToastContextValue | null>(null);

interface ActiveToast {
  id: number;
  variant: ToastVariant;
  message: string;
}

const DEFAULT_DURATION_MS = 4000;

export interface ToastProviderProps {
  children: ReactNode;
  /** Screen corner the toast stack anchors to. Default "bottom-right". */
  position?: ToastViewportPosition;
  /** Already-translated aria-label for each toast's dismiss (✕) button. */
  dismissLabel?: string;
}

/*
 * Host-mounted consumption layer for the shared <Toast>/<ToastViewport>
 * primitives (§6 Lumen). Owns a small live queue plus a per-toast auto-dismiss
 * timer and exposes an imperative `showToast` through context (useToast). Copy
 * is injected already-translated (§6.4); the Provider adds no i18n of its own
 * beyond the host-supplied dismissLabel. Per CLAUDE.md §6.2 it mounts near the
 * top of the host tree (Theme → Toast → Sync), OUTSIDE the section switch, so
 * any screen can raise a toast.
 */
export function ToastProvider({
  children,
  position = "bottom-right",
  dismissLabel = "Dismiss",
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback<ToastContextValue["showToast"]>(
    (variant, message, options) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message }]);
      const durationMs = options?.durationMs ?? DEFAULT_DURATION_MS;
      if (durationMs > 0) {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), durationMs),
        );
      }
    },
    [dismiss],
  );

  // Clear any pending auto-dismiss timers if the Provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const handle of pending.values()) clearTimeout(handle);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && (
        <ToastViewport position={position}>
          {toasts.map((t) => (
            <Toast
              key={t.id}
              variant={t.variant}
              onDismiss={() => dismiss(t.id)}
              dismissLabel={dismissLabel}
            >
              {t.message}
            </Toast>
          ))}
        </ToastViewport>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = createContextHook(ToastContext, "useToast");

/*
 * Null-safe variant (#955), same shape as `useRightSidebarOptional`
 * (vision/coding-principles.md §4).
 *
 * The throwing hook is right for a button whose only job is to raise a toast —
 * without a Provider it is broken and should say so. It is wrong for reporting
 * a FAILURE: a save error path that itself throws because no Provider is
 * mounted turns a recoverable failure into a crash, and it forces every
 * standalone render and every existing test of the screen to wrap a Provider
 * it does not otherwise need. Callers on an error path take this one and fall
 * back to their log.
 */
export const useToastOptional = createOptionalContextHook(ToastContext);
