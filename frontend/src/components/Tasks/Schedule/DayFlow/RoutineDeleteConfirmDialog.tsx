import { useTranslation } from "react-i18next";
import { Trash2, Archive } from "lucide-react";

interface RoutineDeleteConfirmDialogProps {
  title: string;
  position: { x: number; y: number };
  onDismissOnly: () => void;
  onArchiveRoutine: () => void;
  onCancel: () => void;
}

export function RoutineDeleteConfirmDialog({
  title,
  position,
  onDismissOnly,
  onArchiveRoutine,
  onCancel,
}: RoutineDeleteConfirmDialogProps) {
  const { t } = useTranslation();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50" onClick={onCancel} />

      {/* Dialog */}
      <div
        className="fixed z-50 w-72 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
        style={{
          left: Math.min(position.x, window.innerWidth - 300),
          top: Math.min(position.y, window.innerHeight - 280),
        }}
      >
        <div className="p-3 border-b border-notion-border">
          <h3 className="text-sm font-medium text-notion-text">
            {t("schedule.routineDeleteConfirm.title")}
          </h3>
          <p className="text-xs text-notion-text-secondary mt-1">
            {t("schedule.routineDeleteConfirm.description", { title })}
          </p>
        </div>

        <div className="p-2 space-y-1">
          <button
            onClick={onDismissOnly}
            className="w-full flex items-start gap-2 px-2 py-2 rounded hover:bg-notion-hover text-left transition-colors"
          >
            <Trash2
              size={14}
              className="text-notion-text-secondary mt-0.5 shrink-0"
            />
            <div>
              <div className="text-xs font-medium text-notion-text">
                {t("schedule.routineDeleteConfirm.dismissOnly")}
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-0.5">
                {t("schedule.routineDeleteConfirm.dismissOnlyDesc")}
              </div>
            </div>
          </button>

          <button
            onClick={onArchiveRoutine}
            className="w-full flex items-start gap-2 px-2 py-2 rounded hover:bg-notion-hover text-left transition-colors"
          >
            <Archive size={14} className="text-orange-500 mt-0.5 shrink-0" />
            <div>
              <div className="text-xs font-medium text-orange-600 dark:text-orange-400">
                {t("schedule.routineDeleteConfirm.archiveRoutine")}
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-0.5">
                {t("schedule.routineDeleteConfirm.archiveRoutineDesc")}
              </div>
            </div>
          </button>
        </div>

        <div className="p-2 border-t border-notion-border">
          <button
            onClick={onCancel}
            className="w-full text-xs text-notion-text-secondary hover:text-notion-text py-1 transition-colors"
          >
            {t("schedule.routineDeleteConfirm.cancel")}
          </button>
        </div>
      </div>
    </>
  );
}
