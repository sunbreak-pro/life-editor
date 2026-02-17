import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import { TimeInput } from "../../../shared/TimeInput";
import { RoutineTagSelector } from "./RoutineTagSelector";
import { useConfirmableSubmit } from "../../../../hooks/useConfirmableSubmit";

interface RoutineEditDialogProps {
  routine?: RoutineNode;
  tags: RoutineTag[];
  onSubmit: (
    title: string,
    startTime?: string,
    endTime?: string,
    tagId?: number | null,
  ) => void;
  onCreateTag?: (name: string, color: string) => Promise<RoutineTag>;
  onClose: () => void;
}

export function RoutineEditDialog({
  routine,
  tags,
  onSubmit,
  onCreateTag,
  onClose,
}: RoutineEditDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(routine?.title ?? "");
  const [startTime, setStartTime] = useState(routine?.startTime ?? "");
  const [endTime, setEndTime] = useState(routine?.endTime ?? "");
  const [tagId, setTagId] = useState<number | null>(routine?.tagId ?? null);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(title.trim(), startTime || undefined, endTime || undefined, tagId);
    onClose();
  };

  const { inputRef, handleKeyDown, handleBlur, handleFocus, readyToSubmit } =
    useConfirmableSubmit(handleSubmit, onClose);

  useEffect(() => {
    inputRef.current?.focus();
  }, [inputRef]);

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
              onKeyDown={handleKeyDown}
              onBlur={handleBlur}
              onFocus={handleFocus}
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
              <TimeInput
                hour={parseInt(startTime.split(":")[0] || "0", 10)}
                minute={parseInt(startTime.split(":")[1] || "0", 10)}
                onChange={(h, m) =>
                  setStartTime(
                    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                  )
                }
                minuteStep={1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.end", "End")}
              </label>
              <TimeInput
                hour={parseInt(endTime.split(":")[0] || "0", 10)}
                minute={parseInt(endTime.split(":")[1] || "0", 10)}
                onChange={(h, m) =>
                  setEndTime(
                    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
                  )
                }
                minuteStep={1}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.routineTag", "Tag")}
            </label>
            <RoutineTagSelector
              tags={tags}
              selectedTagId={tagId}
              onSelect={setTagId}
              onCreateTag={onCreateTag}
            />
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
            className={`px-3 py-1.5 text-xs bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors disabled:opacity-50 ${readyToSubmit ? "ring-2 ring-notion-accent/50 animate-pulse" : ""}`}
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
