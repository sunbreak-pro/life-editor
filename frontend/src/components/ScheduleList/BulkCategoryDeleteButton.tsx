import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDataService } from "../../services";
import { getErrorMessage } from "../../utils/logError";
import type { CalendarDataKind } from "../../services/DataService";

interface BulkCategoryDeleteButtonProps {
  /** Single category to soft-delete (e.g. "events" or "routines"). */
  kind: Extract<CalendarDataKind, "events" | "routines" | "tasks">;
  /** Compact look for tight toolbars (icon + short label). */
  compact?: boolean;
}

type Stage = "idle" | "confirm" | "deleting";

/**
 * Per-category bulk soft-delete control. Deletes ONLY the given `kind`
 * (routine cascade still applies for "routines") via the shared,
 * test-covered `bulkSoftDeleteCalendarData` IPC. Soft delete → restorable
 * from Trash. Two-stage click confirm to avoid accidental wipes.
 */
export function BulkCategoryDeleteButton({
  kind,
  compact = false,
}: BulkCategoryDeleteButtonProps) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const label = t(`schedule.bulkDelete.${kind}`);

  const handleClick = async () => {
    if (stage === "idle") {
      setStage("confirm");
      setError(null);
      return;
    }
    if (stage !== "confirm") return;
    setStage("deleting");
    setError(null);
    try {
      await getDataService().bulkSoftDeleteCalendarData([kind]);
      // Reload so every Context (Routine / Schedule / TaskTree) re-fetches
      // from the now-updated DB — mirrors the Settings bulk-delete flow.
      setTimeout(() => window.location.reload(), 800);
    } catch (e) {
      setError(
        t("schedule.bulkDelete.failed", {
          error: getErrorMessage(e, t("data.unknownError")),
        }),
      );
      setStage("idle");
    }
  };

  const isConfirm = stage === "confirm";
  const isDeleting = stage === "deleting";

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-xs text-notion-danger" role="alert">
          {error}
        </span>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isDeleting}
        title={label}
        aria-label={label}
        className={`flex items-center gap-1 rounded-md text-white transition-colors disabled:opacity-50 ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"
        } ${
          isConfirm
            ? "bg-notion-danger hover:bg-notion-danger/90"
            : "bg-notion-danger/80 hover:bg-notion-danger"
        }`}
      >
        <Trash2 size={compact ? 13 : 15} aria-hidden="true" />
        <span>
          {isDeleting
            ? t("schedule.bulkDelete.deleting")
            : isConfirm
              ? t("schedule.bulkDelete.confirm")
              : label}
        </span>
      </button>
    </div>
  );
}
