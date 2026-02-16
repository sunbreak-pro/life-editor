import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../types/routine";

interface RoutineEditDialogProps {
  routine?: RoutineNode;
  onSubmit: (title: string, startTime?: string, endTime?: string) => void;
  onClose: () => void;
}

export function RoutineEditDialog({
  routine,
  onSubmit,
  onClose,
}: RoutineEditDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(routine?.title ?? "");
  const [startTime, setStartTime] = useState(routine?.startTime ?? "");
  const [endTime, setEndTime] = useState(routine?.endTime ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim(), startTime || undefined, endTime || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl p-4 w-80">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-notion-text">
            {routine
              ? t("schedule.editRoutine", "Edit Routine")
              : t("schedule.newRoutine", "New Routine")}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.routineTitle", "Title")}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder={t(
                "schedule.routineTitlePlaceholder",
                "Routine name",
              )}
              className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.start", "Start")}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md text-notion-text"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.end", "End")}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-2 py-1.5 text-sm bg-transparent border border-notion-border rounded-md text-notion-text"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-notion-text-secondary hover:bg-notion-hover rounded-md transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors disabled:opacity-50"
          >
            {routine
              ? t("common.save", "Save")
              : t("schedule.create", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
