import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "blue" | "green";
  showDontShowAgain?: boolean;
  onDontShowAgainChange?: (checked: boolean) => void;
}

const VARIANT_CLASSES: Record<string, string> = {
  default: "text-white bg-notion-accent hover:bg-notion-accent/90",
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  green: "bg-green-600 hover:bg-green-700 text-white",
};

export function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
  title,
  confirmLabel,
  cancelLabel,
  variant = "default",
  showDontShowAgain,
  onDontShowAgainChange,
}: ConfirmDialogProps) {
  const { t } = useTranslation();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="bg-notion-bg rounded-xl border border-notion-border shadow-2xl p-6 max-w-sm w-full mx-4">
        {title && (
          <h3 className="text-lg font-semibold text-notion-text mb-2">
            {title}
          </h3>
        )}
        <p className="text-sm text-notion-text-secondary mb-6">{message}</p>
        {showDontShowAgain && (
          <label className="flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="checkbox"
              onChange={(e) => onDontShowAgainChange?.(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-notion-accent"
            />
            <span className="text-xs text-notion-text-secondary">
              {t("taskDetailSidebar.dontShowAgain")}
            </span>
          </label>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-notion-text-secondary hover:text-notion-text rounded-lg hover:bg-notion-hover transition-colors"
          >
            {cancelLabel || t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg transition-colors ${VARIANT_CLASSES[variant]}`}
          >
            {confirmLabel || t("common.ok")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
