import { useTranslation } from "react-i18next";
import { Clock, RefreshCw } from "lucide-react";

interface RoutineTimeChangeDialogProps {
  routineTitle: string;
  newStartTime: string;
  newEndTime: string;
  onThisOnly: () => void;
  onApplyToRoutine: () => void;
  onCancel: () => void;
  zIndex?: number;
}

export function RoutineTimeChangeDialog({
  routineTitle,
  newStartTime,
  newEndTime,
  onThisOnly,
  onApplyToRoutine,
  onCancel,
  zIndex = 50,
}: RoutineTimeChangeDialogProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20"
        style={{ zIndex }}
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        className="fixed w-80 bg-notion-bg border border-notion-border rounded-lg shadow-xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ zIndex }}
      >
        <div className="p-3 border-b border-notion-border">
          <h3 className="text-sm font-medium text-notion-text">
            {t("schedule.routineTimeChange.title", "Update routine time?")}
          </h3>
          <p className="text-xs text-notion-text-secondary mt-1">
            {t("schedule.routineTimeChange.description", {
              title: routineTitle,
              time: `${newStartTime} - ${newEndTime}`,
              defaultValue: `"{{title}}" was changed to {{time}}.`,
            })}
          </p>
        </div>

        <div className="p-2 space-y-1">
          <button
            onClick={onThisOnly}
            className="w-full flex items-start gap-2 px-2 py-2 rounded hover:bg-notion-hover text-left transition-colors"
          >
            <Clock
              size={14}
              className="text-notion-text-secondary mt-0.5 shrink-0"
            />
            <div>
              <div className="text-xs font-medium text-notion-text">
                {t("schedule.routineTimeChange.thisOnly", "This time only")}
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-0.5">
                {t(
                  "schedule.routineTimeChange.thisOnlyDesc",
                  "Only change today's schedule. The routine template stays the same.",
                )}
              </div>
            </div>
          </button>

          <button
            onClick={onApplyToRoutine}
            className="w-full flex items-start gap-2 px-2 py-2 rounded hover:bg-notion-hover text-left transition-colors"
          >
            <RefreshCw size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {t(
                  "schedule.routineTimeChange.applyToRoutine",
                  "Update routine template",
                )}
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-0.5">
                {t(
                  "schedule.routineTimeChange.applyToRoutineDesc",
                  "Also update the routine's default time for future schedules.",
                )}
              </div>
            </div>
          </button>
        </div>

        <div className="p-2 border-t border-notion-border">
          <button
            onClick={onCancel}
            className="w-full text-xs text-notion-text-secondary hover:text-notion-text py-1 transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </>
  );
}
