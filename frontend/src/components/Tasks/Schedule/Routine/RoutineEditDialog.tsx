import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineNode, FrequencyType } from "../../../../types/routine";
import type { RoutineTag } from "../../../../types/routineTag";
import { TimeInput } from "../../../shared/TimeInput";
import { RoutineTagSelector } from "./RoutineTagSelector";
import { FrequencySelector } from "./FrequencySelector";
import { useConfirmableSubmit } from "../../../../hooks/useConfirmableSubmit";
import {
  adjustEndTimeForStartChange,
  clampEndTimeAfterStart,
} from "../../../../utils/timeGridUtils";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface RoutineEditDialogProps {
  routine?: RoutineNode;
  tags: RoutineTag[];
  initialTagIds?: number[];
  onSubmit: (
    title: string,
    startTime?: string,
    endTime?: string,
    tagIds?: number[],
    frequencyType?: FrequencyType,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ) => void;
  onCreateTag?: (name: string, color: string) => Promise<RoutineTag>;
  onClose: () => void;
}

export function RoutineEditDialog({
  routine,
  tags,
  initialTagIds,
  onSubmit,
  onCreateTag,
  onClose,
}: RoutineEditDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(routine?.title ?? "");
  const [startTime, setStartTime] = useState(routine?.startTime ?? "");
  const [endTime, setEndTime] = useState(routine?.endTime ?? "");
  const prevStartRef = useRef(startTime);
  const [tagIds, setTagIds] = useState<number[]>(initialTagIds ?? []);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(
    routine?.frequencyType ?? "daily",
  );
  const [frequencyDays, setFrequencyDays] = useState<number[]>(
    routine?.frequencyDays ?? [],
  );
  const [frequencyInterval, setFrequencyInterval] = useState(
    routine?.frequencyInterval ?? 2,
  );
  const [frequencyStartDate, setFrequencyStartDate] = useState(
    routine?.frequencyStartDate ?? todayStr(),
  );

  const handleSubmit = () => {
    if (!title.trim()) return;
    onSubmit(
      title.trim(),
      startTime || undefined,
      endTime || undefined,
      tagIds,
      frequencyType,
      frequencyType === "weekdays" ? frequencyDays : [],
      frequencyType === "interval" ? frequencyInterval : null,
      frequencyType === "interval" ? frequencyStartDate : null,
    );
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
          <h3 className="text-base font-semibold text-notion-text">
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
            <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
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
              className="w-full px-2 py-1.5 text-base bg-transparent border border-notion-border rounded-md outline-none focus:border-notion-accent text-notion-text placeholder:text-notion-text-secondary"
            />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.start", "Start")}
              </label>
              <TimeInput
                hour={parseInt(startTime.split(":")[0] || "0", 10)}
                minute={parseInt(startTime.split(":")[1] || "0", 10)}
                onChange={(h, m) => {
                  const newStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  if (prevStartRef.current && endTime) {
                    setEndTime(
                      adjustEndTimeForStartChange(
                        prevStartRef.current,
                        newStart,
                        endTime,
                      ),
                    );
                  }
                  prevStartRef.current = newStart;
                  setStartTime(newStart);
                }}
                minuteStep={1}
              />
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
                {t("schedule.end", "End")}
              </label>
              <TimeInput
                hour={parseInt(endTime.split(":")[0] || "0", 10)}
                minute={parseInt(endTime.split(":")[1] || "0", 10)}
                onChange={(h, m) => {
                  const newEnd = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
                  setEndTime(
                    startTime
                      ? clampEndTimeAfterStart(startTime, newEnd)
                      : newEnd,
                  );
                }}
                minuteStep={1}
              />
            </div>
          </div>

          <FrequencySelector
            frequencyType={frequencyType}
            frequencyDays={frequencyDays}
            frequencyInterval={frequencyInterval}
            frequencyStartDate={frequencyStartDate}
            onFrequencyTypeChange={setFrequencyType}
            onFrequencyDaysChange={setFrequencyDays}
            onFrequencyIntervalChange={setFrequencyInterval}
            onFrequencyStartDateChange={setFrequencyStartDate}
          />

          <div>
            <label className="text-[11px] text-notion-text-secondary uppercase tracking-wide mb-1 block">
              {t("schedule.routineTag", "Tags")}
            </label>
            <RoutineTagSelector
              tags={tags}
              selectedTagIds={tagIds}
              onSelect={setTagIds}
              onCreateTag={onCreateTag}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-notion-text-secondary hover:bg-notion-hover rounded-md transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className={`px-3 py-1.5 text-sm bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 transition-colors disabled:opacity-50 ${readyToSubmit ? "ring-2 ring-notion-accent/50 animate-pulse" : ""}`}
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
