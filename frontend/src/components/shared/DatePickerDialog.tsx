import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface DatePickerDialogProps {
  defaultDate?: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}

export function DatePickerDialog({
  defaultDate,
  onConfirm,
  onCancel,
}: DatePickerDialogProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(
    defaultDate ?? new Date().toISOString().slice(0, 10),
  );
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (date) onConfirm(date);
    },
    [date, onConfirm],
  );

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel]);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onCancel}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-notion-bg border border-notion-border rounded-lg shadow-xl p-5 min-w-[300px]"
      >
        <h3 className="text-sm font-semibold text-notion-text mb-3">
          {t("copy.selectDate")}
        </h3>
        <input
          ref={inputRef}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-md border border-notion-border bg-notion-bg text-notion-text focus:outline-none focus:ring-1 focus:ring-notion-accent"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-md text-notion-text-secondary hover:bg-notion-hover"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={!date}
            className="px-3 py-1.5 text-sm rounded-md bg-notion-accent text-white hover:opacity-90 disabled:opacity-50"
          >
            {t("common.ok")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
