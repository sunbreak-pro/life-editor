import { useState, useCallback, useMemo } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { RoutineGroup } from "../../../../types/routineGroup";
import type { RoutineTag } from "../../../../types/routineTag";
import type { RoutineNode, FrequencyType } from "../../../../types/routine";
import { UnifiedColorPicker } from "../../../shared/UnifiedColorPicker";
import { RoutineGroupTagPicker } from "./RoutineGroupTagPicker";
import { FrequencySelector } from "./FrequencySelector";
import { TimeInput } from "../../../shared/TimeInput";
import { formatTime, timeToMinutes } from "../../../../utils/timeGridUtils";
import { getTodayKey } from "../../../../utils/dateKey";

interface RoutineGroupEditDialogProps {
  group?: RoutineGroup;
  tags: RoutineTag[];
  initialTagIds: number[];
  memberRoutines: RoutineNode[];
  groupTimeRange?: { startTime: string; endTime: string };
  onSubmit: (
    name: string,
    color: string,
    tagIds: number[],
    frequencyType?: FrequencyType,
    frequencyDays?: number[],
    frequencyInterval?: number | null,
    frequencyStartDate?: string | null,
  ) => void;
  onSlideGroup?: (offsetMinutes: number) => void;
  onSlideGroupEndTime?: (offsetMinutes: number) => void;
  onUpdateRoutine?: (
    id: string,
    updates: Partial<
      Pick<
        RoutineNode,
        | "startTime"
        | "endTime"
        | "frequencyType"
        | "frequencyDays"
        | "frequencyInterval"
        | "frequencyStartDate"
      >
    >,
  ) => void;
  allRoutines?: RoutineNode[];
  allTagAssignments?: Map<string, number[]>;
  onClose: () => void;
}

export function RoutineGroupEditDialog({
  group,
  tags,
  initialTagIds,
  memberRoutines,
  groupTimeRange,
  onSubmit,
  onSlideGroup,
  onSlideGroupEndTime,
  onUpdateRoutine,
  allRoutines,
  allTagAssignments,
  onClose,
}: RoutineGroupEditDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(group?.name ?? "");
  const [color, setColor] = useState(group?.color ?? "#6B7280");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(initialTagIds);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [frequencyType, setFrequencyType] = useState<FrequencyType>(
    group?.frequencyType ?? "daily",
  );
  const [frequencyDays, setFrequencyDays] = useState<number[]>(
    group?.frequencyDays ?? [],
  );
  const [frequencyInterval, setFrequencyInterval] = useState(
    group?.frequencyInterval ?? 2,
  );
  const [frequencyStartDate, setFrequencyStartDate] = useState(
    group?.frequencyStartDate ?? getTodayKey(),
  );

  // Compute displayed member routines (edit: from prop, create: from selected tags)
  const displayedRoutines = useMemo(() => {
    const base = group
      ? memberRoutines
      : !allRoutines || !allTagAssignments || selectedTagIds.length === 0
        ? []
        : (() => {
            const tagSet = new Set(selectedTagIds);
            return allRoutines.filter((r) => {
              if (r.isArchived || r.isDeleted) return false;
              const routineTags = allTagAssignments.get(r.id) ?? [];
              return routineTags.some((tid) => tagSet.has(tid));
            });
          })();
    return [...base].sort((a, b) => {
      const aMin = a.startTime ? timeToMinutes(a.startTime) : null;
      const bMin = b.startTime ? timeToMinutes(b.startTime) : null;
      if (aMin === null && bMin === null) return a.title.localeCompare(b.title);
      if (aMin === null) return 1;
      if (bMin === null) return -1;
      if (aMin !== bMin) return aMin - bMin;
      return a.title.localeCompare(b.title);
    });
  }, [group, memberRoutines, allRoutines, allTagAssignments, selectedTagIds]);

  // Track per-routine time edits
  const [routineTimeEdits, setRoutineTimeEdits] = useState<
    Map<string, { startTime: string; endTime: string }>
  >(new Map());

  const handleSubmit = useCallback(() => {
    if (!name.trim()) return;
    const groupFrequencyDays =
      frequencyType === "weekdays" ? frequencyDays : [];
    const groupFrequencyInterval =
      frequencyType === "interval" ? frequencyInterval : null;
    const groupFrequencyStartDate =
      frequencyType === "interval" ? frequencyStartDate : null;

    onSubmit(
      name.trim(),
      color,
      selectedTagIds,
      frequencyType,
      groupFrequencyDays,
      groupFrequencyInterval,
      groupFrequencyStartDate,
    );

    if (onUpdateRoutine) {
      for (const routine of displayedRoutines) {
        const times = routineTimeEdits.get(routine.id);
        const updates: Parameters<typeof onUpdateRoutine>[1] = {
          frequencyType,
          frequencyDays: groupFrequencyDays,
          frequencyInterval: groupFrequencyInterval,
          frequencyStartDate: groupFrequencyStartDate,
        };
        if (times) {
          updates.startTime = times.startTime;
          updates.endTime = times.endTime;
        }
        onUpdateRoutine(routine.id, updates);
      }
    }
    onClose();
  }, [
    name,
    color,
    selectedTagIds,
    frequencyType,
    frequencyDays,
    frequencyInterval,
    frequencyStartDate,
    onSubmit,
    onClose,
    onUpdateRoutine,
    routineTimeEdits,
    displayedRoutines,
  ]);

  const handleSlide = useCallback(
    (newStartTime: string) => {
      if (!groupTimeRange || !onSlideGroup) return;
      const currentStart = timeToMinutes(groupTimeRange.startTime);
      const newStart = timeToMinutes(newStartTime);
      const offset = newStart - currentStart;
      if (offset !== 0) {
        onSlideGroup(offset);
      }
    },
    [groupTimeRange, onSlideGroup],
  );

  const handleSlideEnd = useCallback(
    (newEndTime: string) => {
      if (!groupTimeRange || !onSlideGroupEndTime) return;
      const currentEnd = timeToMinutes(groupTimeRange.endTime);
      const newEnd = timeToMinutes(newEndTime);
      const offset = newEnd - currentEnd;
      if (offset !== 0) {
        onSlideGroupEndTime(offset);
      }
    },
    [groupTimeRange, onSlideGroupEndTime],
  );

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-notion-bg border border-notion-border rounded-lg shadow-xl w-[420px] max-h-[70vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-notion-border">
          <h4 className="text-sm font-semibold text-notion-text">
            {group
              ? t("routineGroup.edit", "Edit Group")
              : t("routineGroup.create", "Create Group")}
          </h4>
          <button
            onClick={onClose}
            className="p-1 text-notion-text-secondary hover:text-notion-text rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Name */}
          <div>
            <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
              {t("routineGroup.name", "Group Name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(
                "routineGroup.namePlaceholder",
                "e.g. Morning Routine",
              )}
              className="w-full px-2 py-1.5 text-sm bg-notion-bg-secondary border border-notion-border rounded focus:outline-none focus:ring-1 focus:ring-notion-accent text-notion-text"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit();
              }}
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
              {t("routineGroup.color", "Color")}
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-6 h-6 rounded-md border border-notion-border"
                style={{ backgroundColor: color }}
              />
              <span className="text-[11px] text-notion-text-secondary">
                {color}
              </span>
            </div>
            {showColorPicker && (
              <div className="mt-2">
                <UnifiedColorPicker
                  color={color}
                  onChange={setColor}
                  mode="preset-only"
                  inline
                />
              </div>
            )}
          </div>

          {/* Tag assignment */}
          <RoutineGroupTagPicker
            tags={tags}
            selectedTagIds={selectedTagIds}
            onChange={setSelectedTagIds}
          />

          {/* Frequency */}
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

          {/* Group slide (edit mode only) */}
          {group && groupTimeRange && onSlideGroup && (
            <div>
              <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
                {t("routineGroup.timeRange", "Time Range")}
              </label>
              <div className="flex items-center gap-2 text-sm text-notion-text">
                <TimeInput
                  hour={parseInt(
                    groupTimeRange.startTime.split(":")[0] || "0",
                    10,
                  )}
                  minute={parseInt(
                    groupTimeRange.startTime.split(":")[1] || "0",
                    10,
                  )}
                  onChange={(h, m) => {
                    handleSlide(formatTime(h, m));
                  }}
                  minuteStep={5}
                  size="sm"
                />
                <span className="text-notion-text-secondary">-</span>
                <TimeInput
                  hour={parseInt(
                    groupTimeRange.endTime.split(":")[0] || "0",
                    10,
                  )}
                  minute={parseInt(
                    groupTimeRange.endTime.split(":")[1] || "0",
                    10,
                  )}
                  onChange={(h, m) => {
                    handleSlideEnd(formatTime(h, m));
                  }}
                  minuteStep={5}
                  size="sm"
                />
              </div>
              <div className="text-[10px] text-notion-text-secondary mt-1">
                {t(
                  "routineGroup.slideHint",
                  "Changing start time slides all member routines",
                )}
              </div>
              {memberRoutines.length > 0 && (
                <div className="mt-1 text-[10px] text-notion-text-secondary">
                  {memberRoutines.length}{" "}
                  {t("routineGroup.members", "routines")}
                </div>
              )}
            </div>
          )}

          {/* Member Routines */}
          {displayedRoutines.length > 0 && (
            <div>
              <label className="text-[11px] text-notion-text-secondary font-medium block mb-1">
                {t("routineGroup.memberRoutines", "Member Routines")}
                <span className="ml-1">({displayedRoutines.length})</span>
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {displayedRoutines.map((routine) => {
                  const edited = routineTimeEdits.get(routine.id);
                  const startTime =
                    edited?.startTime ?? routine.startTime ?? "09:00";
                  const endTime = edited?.endTime ?? routine.endTime ?? "09:30";
                  const [startH, startM] = startTime.split(":").map(Number);
                  const [endH, endM] = endTime.split(":").map(Number);
                  const hasNoTime = !routine.startTime && !routine.endTime;
                  return (
                    <div
                      key={routine.id}
                      className="flex items-center gap-2 text-xs text-notion-text"
                    >
                      <span className="truncate flex-1 min-w-0">
                        {routine.title}
                        {hasNoTime && (
                          <span className="ml-1 text-[10px] text-notion-text-secondary">
                            ({t("routineGroup.noTimeSet", "no time set")})
                          </span>
                        )}
                      </span>
                      <TimeInput
                        hour={startH}
                        minute={startM}
                        onChange={(h, m) => {
                          const newStart = formatTime(h, m);
                          setRoutineTimeEdits((prev) => {
                            const next = new Map(prev);
                            next.set(routine.id, {
                              startTime: newStart,
                              endTime:
                                edited?.endTime ?? routine.endTime ?? "09:30",
                            });
                            return next;
                          });
                        }}
                        minuteStep={5}
                        size="sm"
                      />
                      <span className="text-notion-text-secondary">-</span>
                      <TimeInput
                        hour={endH}
                        minute={endM}
                        onChange={(h, m) => {
                          const newEnd = formatTime(h, m);
                          setRoutineTimeEdits((prev) => {
                            const next = new Map(prev);
                            next.set(routine.id, {
                              startTime:
                                edited?.startTime ??
                                routine.startTime ??
                                "09:00",
                              endTime: newEnd,
                            });
                            return next;
                          });
                        }}
                        minuteStep={5}
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-notion-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-notion-danger hover:bg-notion-danger/10 rounded-md transition-colors"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-sm bg-notion-accent text-white rounded-md hover:bg-notion-accent/90 disabled:opacity-50 transition-colors"
          >
            {group ? t("common.save", "Save") : t("schedule.create", "Create")}
          </button>
        </div>
      </div>
    </div>
  );
}
