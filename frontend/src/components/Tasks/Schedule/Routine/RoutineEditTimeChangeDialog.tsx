import { useTranslation } from "react-i18next";
import { Clock, RefreshCw } from "lucide-react";

interface RoutineEditTimeChangeDialogProps {
  routineTitle: string;
  newTime: string;
  onTemplateOnly: () => void;
  onApplyToAll: () => void;
  onCancel: () => void;
}

export function RoutineEditTimeChangeDialog({
  routineTitle,
  newTime,
  onTemplateOnly,
  onApplyToAll,
  onCancel,
}: RoutineEditTimeChangeDialogProps) {
  const { t } = useTranslation();

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/20" onClick={onCancel} />

      <div className="fixed z-[60] w-80 bg-notion-bg border border-notion-border rounded-lg shadow-xl top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="p-3 border-b border-notion-border">
          <h3 className="text-sm font-medium text-notion-text">
            {t("schedule.routineEditTimeChange.title")}
          </h3>
          <p className="text-xs text-notion-text-secondary mt-1">
            {t("schedule.routineEditTimeChange.description", {
              title: routineTitle,
              time: newTime,
            })}
          </p>
        </div>

        <div className="p-2 space-y-1">
          <button
            onClick={onTemplateOnly}
            className="w-full flex items-start gap-2 px-2 py-2 rounded hover:bg-notion-hover text-left transition-colors"
          >
            <Clock
              size={14}
              className="text-notion-text-secondary mt-0.5 shrink-0"
            />
            <div>
              <div className="text-xs font-medium text-notion-text">
                {t("schedule.routineEditTimeChange.templateOnly")}
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-0.5">
                {t("schedule.routineEditTimeChange.templateOnlyDesc")}
              </div>
            </div>
          </button>

          <button
            onClick={onApplyToAll}
            className="w-full flex items-start gap-2 px-2 py-2 rounded hover:bg-notion-hover text-left transition-colors"
          >
            <RefreshCw size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-medium text-blue-600 dark:text-blue-400">
                {t("schedule.routineEditTimeChange.applyToAll")}
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-0.5">
                {t("schedule.routineEditTimeChange.applyToAllDesc")}
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
