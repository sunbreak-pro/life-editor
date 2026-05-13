import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle } from "lucide-react";
import { getDataService } from "../../services";
import type {
  BulkSoftDeleteResult,
  CalendarDataKind,
} from "../../services/DataService";

interface CalendarDataResetDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called after a successful bulk delete so callers can trigger a UI reload. */
  onDeleted?: (result: BulkSoftDeleteResult) => void;
}

type Selection = Record<CalendarDataKind, boolean>;

const ALL_KINDS: readonly CalendarDataKind[] = [
  "tasks",
  "events",
  "routines",
  "dailies",
  "notes",
];

const emptySelection: Selection = {
  tasks: false,
  events: false,
  routines: false,
  dailies: false,
  notes: false,
};

export function CalendarDataResetDialog({
  open,
  onClose,
  onDeleted,
}: CalendarDataResetDialogProps) {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>(emptySelection);
  const [confirmStage, setConfirmStage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset internal state every time the dialog re-opens so the user starts
  // from a clean selection instead of inheriting the previous run.
  useEffect(() => {
    if (open) {
      setSelection(emptySelection);
      setConfirmStage(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  const selectedKinds = useMemo(
    () => ALL_KINDS.filter((kind) => selection[kind]),
    [selection],
  );
  const hasSelection = selectedKinds.length > 0;

  if (!open) return null;

  const toggleKind = (kind: CalendarDataKind) => {
    setSelection((prev) => ({ ...prev, [kind]: !prev[kind] }));
    setError(null);
  };

  const selectAll = () => {
    setSelection({
      tasks: true,
      events: true,
      routines: true,
      dailies: true,
      notes: true,
    });
    setError(null);
  };

  const deselectAll = () => {
    setSelection(emptySelection);
    setError(null);
  };

  const handlePrimary = async () => {
    if (!hasSelection) {
      setError(t("settings.calendarReset.noSelection"));
      return;
    }
    if (!confirmStage) {
      setConfirmStage(true);
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const result =
        await getDataService().bulkSoftDeleteCalendarData(selectedKinds);
      onDeleted?.(result);
      onClose();
    } catch (e) {
      setError(
        t("settings.calendarReset.failed", {
          error: e instanceof Error ? e.message : t("data.unknownError"),
        }),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("settings.calendarReset.title")}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div className="bg-notion-bg rounded-xl border border-notion-border shadow-2xl p-6 max-w-md w-full mx-4">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle
            size={18}
            className="text-notion-danger"
            aria-hidden="true"
          />
          <h3 className="text-lg font-semibold text-notion-text">
            {t("settings.calendarReset.title")}
          </h3>
        </div>
        <p className="text-sm text-notion-text-secondary mb-4">
          {t("settings.calendarReset.description")}
        </p>

        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              disabled={isSubmitting}
              className="px-2 py-1 text-xs rounded-md bg-notion-hover text-notion-text hover:bg-notion-border transition-colors disabled:opacity-50"
            >
              {t("settings.calendarReset.selectAll")}
            </button>
            <button
              type="button"
              onClick={deselectAll}
              disabled={isSubmitting}
              className="px-2 py-1 text-xs rounded-md bg-notion-hover text-notion-text hover:bg-notion-border transition-colors disabled:opacity-50"
            >
              {t("settings.calendarReset.deselectAll")}
            </button>
          </div>
        </div>

        <ul className="space-y-2 mb-4">
          {ALL_KINDS.map((kind) => (
            <li key={kind}>
              <label className="flex items-center gap-2 cursor-pointer rounded-md px-2 py-1 hover:bg-notion-hover transition-colors">
                <input
                  type="checkbox"
                  checked={selection[kind]}
                  onChange={() => toggleKind(kind)}
                  disabled={isSubmitting}
                  className="w-4 h-4 rounded accent-notion-danger"
                  aria-label={t(`settings.calendarReset.kinds.${kind}`)}
                />
                <span className="text-sm text-notion-text">
                  {t(`settings.calendarReset.kinds.${kind}`)}
                </span>
              </label>
            </li>
          ))}
        </ul>

        {error && (
          <p className="text-xs text-notion-danger mb-3" role="alert">
            {error}
          </p>
        )}

        <p className="text-xs text-notion-text-secondary mb-4">
          {t("settings.calendarReset.footnote")}
        </p>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm text-notion-text-secondary hover:text-notion-text rounded-lg hover:bg-notion-hover transition-colors disabled:opacity-50"
          >
            {t("settings.calendarReset.cancel")}
          </button>
          <button
            type="button"
            onClick={handlePrimary}
            disabled={isSubmitting}
            className={`px-4 py-2 text-sm rounded-lg text-white transition-colors ${
              confirmStage
                ? "bg-notion-danger hover:bg-notion-danger/90"
                : "bg-notion-danger/80 hover:bg-notion-danger"
            } disabled:opacity-50`}
          >
            {confirmStage
              ? t("settings.calendarReset.confirm")
              : t("settings.calendarReset.openButton")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
