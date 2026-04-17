import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";
import type { ToastVariant } from "../../context/ToastContext";

interface ToastProps {
  variant: ToastVariant;
  message: string;
  durationMs: number;
  onDismiss: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

const variantConfig: Record<
  ToastVariant,
  { bg: string; Icon: typeof CheckCircle2 }
> = {
  success: { bg: "bg-notion-accent", Icon: CheckCircle2 },
  warning: { bg: "bg-yellow-500", Icon: AlertTriangle },
  error: { bg: "bg-red-500", Icon: XCircle },
  info: { bg: "bg-blue-500", Icon: Info },
};

export function Toast({
  variant,
  message,
  durationMs,
  onDismiss,
  actionLabel,
  onAction,
}: ToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const { bg, Icon } = variantConfig[variant];

  useEffect(() => {
    const exitTimer = setTimeout(() => setIsExiting(true), durationMs - 300);
    const dismissTimer = setTimeout(onDismiss, durationMs);
    return () => {
      clearTimeout(exitTimer);
      clearTimeout(dismissTimer);
    };
  }, [durationMs, onDismiss]);

  return createPortal(
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${bg} text-white shadow-lg ${
          isExiting ? "toast-exit" : "toast-enter"
        }`}
      >
        <Icon size={16} />
        <span className="text-sm font-medium">{message}</span>
        {actionLabel && onAction && (
          <button
            onClick={() => {
              onAction();
              onDismiss();
            }}
            className="ml-2 px-2 py-0.5 text-xs font-medium bg-white/20 hover:bg-white/30 rounded transition-colors pointer-events-auto"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
