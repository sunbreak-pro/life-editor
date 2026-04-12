import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useClickOutside } from "../../hooks/useClickOutside";
import { useClampedPosition } from "../../hooks/useClampedPosition";
import { TimeDropdown } from "../shared/TimeDropdown";
import { RoutineTagSelector } from "../Tasks/Schedule/Routine/RoutineTagSelector";
import type { RoutineNode } from "../../types/routine";
import type { ScheduleItem } from "../../types/schedule";
import type { TaskNode } from "../../types/taskTree";
import type { RoutineTag } from "../../types/routineTag";
import { useTranslation } from "react-i18next";

export type EditTarget =
  | { type: "routine"; routineId: string; scheduleItemId: string | null }
  | { type: "event"; scheduleItemId: string }
  | { type: "task"; taskId: string };

interface ScheduleItemEditPopupProps {
  target: EditTarget;
  position: { x: number; y: number };
  onClose: () => void;
  routines: RoutineNode[];
  scheduleItems: ScheduleItem[];
  tasks: TaskNode[];
  routineTags: RoutineTag[];
  tagAssignments: Map<string, number[]>;
  onUpdateRoutine: (
    id: string,
    updates: Partial<Pick<RoutineNode, "title" | "startTime" | "endTime">>,
  ) => void;
  onSetTagsForRoutine: (routineId: string, tagIds: number[]) => void;
  onUpdateScheduleItem: (
    id: string,
    updates: Partial<Pick<ScheduleItem, "title" | "startTime" | "endTime">>,
  ) => void;
  onUpdateTask: (
    taskId: string,
    updates: Partial<
      Pick<TaskNode, "title" | "scheduledAt" | "scheduledEndAt">
    >,
  ) => void;
  onCreateRoutineTag?: (name: string, color: string) => Promise<RoutineTag>;
}

function parseTime(time: string | null): { hour: number; minute: number } {
  if (!time) return { hour: 9, minute: 0 };
  const [h, m] = time.split(":").map(Number);
  return { hour: h ?? 9, minute: m ?? 0 };
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseScheduledAt(scheduledAt: string | null): {
  hour: number;
  minute: number;
} {
  if (!scheduledAt) return { hour: 9, minute: 0 };
  const d = new Date(scheduledAt);
  return { hour: d.getHours(), minute: d.getMinutes() };
}

function buildScheduledAt(
  baseDate: string | null,
  hour: number,
  minute: number,
): string {
  const d = baseDate ? new Date(baseDate) : new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function ScheduleItemEditPopup({
  target,
  position,
  onClose,
  routines,
  scheduleItems,
  tasks,
  routineTags,
  tagAssignments,
  onUpdateRoutine,
  onSetTagsForRoutine,
  onUpdateScheduleItem,
  onUpdateTask,
  onCreateRoutineTag,
}: ScheduleItemEditPopupProps) {
  const { t } = useTranslation();
  const popupRef = useRef<HTMLDivElement>(null);
  const clamped = useClampedPosition(popupRef, position);

  useClickOutside(popupRef, onClose);

  // Resolve the item data
  const itemData = useMemo(() => {
    if (target.type === "routine") {
      const routine = routines.find((r) => r.id === target.routineId);
      if (!routine) return null;
      const scheduleItem = target.scheduleItemId
        ? scheduleItems.find((si) => si.id === target.scheduleItemId)
        : null;
      return {
        type: "routine" as const,
        id: routine.id,
        title: routine.title,
        startTime: scheduleItem?.startTime ?? routine.startTime,
        endTime: scheduleItem?.endTime ?? routine.endTime,
        tagIds: tagAssignments.get(routine.id) ?? [],
        scheduleItemId: target.scheduleItemId,
      };
    }
    if (target.type === "event") {
      const si = scheduleItems.find((s) => s.id === target.scheduleItemId);
      if (!si) return null;
      return {
        type: "event" as const,
        id: si.id,
        title: si.title,
        startTime: si.startTime,
        endTime: si.endTime,
      };
    }
    const task = tasks.find((t) => t.id === target.taskId);
    if (!task) return null;
    return {
      type: "task" as const,
      id: task.id,
      title: task.title,
      scheduledAt: task.scheduledAt,
      scheduledEndAt: task.scheduledEndAt,
    };
  }, [target, routines, scheduleItems, tasks, tagAssignments]);

  const [title, setTitle] = useState("");
  const [startHour, setStartHour] = useState(9);
  const [startMinute, setStartMinute] = useState(0);
  const [endHour, setEndHour] = useState(10);
  const [endMinute, setEndMinute] = useState(0);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  // Initialize form from item data
  useEffect(() => {
    if (!itemData) return;
    setTitle(itemData.title);
    if (itemData.type === "task") {
      const start = parseScheduledAt(itemData.scheduledAt);
      setStartHour(start.hour);
      setStartMinute(start.minute);
      const end = parseScheduledAt(itemData.scheduledEndAt);
      setEndHour(end.hour);
      setEndMinute(end.minute);
    } else {
      const start = parseTime(itemData.startTime);
      setStartHour(start.hour);
      setStartMinute(start.minute);
      const end = parseTime(itemData.endTime);
      setEndHour(end.hour);
      setEndMinute(end.minute);
    }
    if (itemData.type === "routine") {
      setSelectedTagIds(itemData.tagIds);
    }
  }, [itemData]);

  const handleSave = useCallback(() => {
    if (!itemData) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    if (itemData.type === "routine") {
      const newStart = formatTime(startHour, startMinute);
      const newEnd = formatTime(endHour, endMinute);
      onUpdateRoutine(itemData.id, {
        title: trimmedTitle,
        startTime: newStart,
        endTime: newEnd,
      });
      if (itemData.scheduleItemId) {
        onUpdateScheduleItem(itemData.scheduleItemId, {
          title: trimmedTitle,
          startTime: newStart,
          endTime: newEnd,
        });
      }
      if (JSON.stringify(selectedTagIds) !== JSON.stringify(itemData.tagIds)) {
        onSetTagsForRoutine(itemData.id, selectedTagIds);
      }
    } else if (itemData.type === "event") {
      onUpdateScheduleItem(itemData.id, {
        title: trimmedTitle,
        startTime: formatTime(startHour, startMinute),
        endTime: formatTime(endHour, endMinute),
      });
    } else {
      onUpdateTask(itemData.id, {
        title: trimmedTitle,
        scheduledAt: buildScheduledAt(
          itemData.scheduledAt,
          startHour,
          startMinute,
        ),
        scheduledEndAt: buildScheduledAt(
          itemData.scheduledAt,
          endHour,
          endMinute,
        ),
      });
    }
    onClose();
  }, [
    itemData,
    title,
    startHour,
    startMinute,
    endHour,
    endMinute,
    selectedTagIds,
    onUpdateRoutine,
    onUpdateScheduleItem,
    onUpdateTask,
    onSetTagsForRoutine,
    onClose,
  ]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        onClose();
      }
    },
    [handleSave, onClose],
  );

  if (!itemData) return null;

  const typeLabel =
    itemData.type === "routine"
      ? t("schedule.editRoutine", "Edit Routine")
      : itemData.type === "event"
        ? t("schedule.editEvent", "Edit Event")
        : t("schedule.editTask", "Edit Task");

  return createPortal(
    <div
      ref={popupRef}
      className="fixed z-50 w-72 bg-notion-bg border border-notion-border rounded-lg shadow-lg"
      style={{ left: clamped.x, top: clamped.y }}
      onKeyDown={handleKeyDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-notion-border">
        <span className="text-xs font-medium text-notion-text">
          {typeLabel}
        </span>
        <button
          onClick={onClose}
          className="p-0.5 rounded hover:bg-notion-hover text-notion-text-secondary hover:text-notion-text transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-3">
        {/* Title */}
        <div>
          <label className="block text-[10px] text-notion-text-secondary mb-1">
            {t("schedule.routineTitle", "Title")}
          </label>
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-notion-bg-secondary border border-notion-border rounded-md text-notion-text outline-none focus:border-notion-accent/50 transition-colors"
          />
        </div>

        {/* Time */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-[10px] text-notion-text-secondary mb-1">
              {t("schedule.start", "Start")}
            </label>
            <TimeDropdown
              hour={startHour}
              minute={startMinute}
              onChange={(h, m) => {
                setStartHour(h);
                setStartMinute(m);
              }}
              size="sm"
            />
          </div>
          <span className="text-notion-text-secondary mt-4">-</span>
          <div className="flex-1">
            <label className="block text-[10px] text-notion-text-secondary mb-1">
              {t("schedule.end", "End")}
            </label>
            <TimeDropdown
              hour={endHour}
              minute={endMinute}
              onChange={(h, m) => {
                setEndHour(h);
                setEndMinute(m);
              }}
              size="sm"
            />
          </div>
        </div>

        {/* Tags (routine only) */}
        {itemData.type === "routine" && (
          <div>
            <label className="block text-[10px] text-notion-text-secondary mb-1">
              {t("schedule.routineTag", "Tags")}
            </label>
            <RoutineTagSelector
              tags={routineTags}
              selectedTagIds={selectedTagIds}
              onSelect={setSelectedTagIds}
              onCreateTag={onCreateRoutineTag}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-notion-border flex justify-end">
        <button
          onClick={handleSave}
          className="px-3 py-1 text-xs bg-notion-accent text-white rounded-md hover:opacity-90 transition-opacity"
        >
          {t("common.save", "Save")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
