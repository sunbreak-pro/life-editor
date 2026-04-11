import { useRef, useState, useCallback } from "react";
import {
  ExternalLink,
  Play,
  Trash2,
  Clock,
  CalendarDays,
  StickyNote,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTime } from "../../../../utils/timeGridUtils";
import type { TaskNode } from "../../../../types/taskTree";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { ConfirmDialog } from "../../../shared/ConfirmDialog";
import { TimeInput } from "../../../shared/TimeInput";
import { DateInput } from "../../../shared/DateInput";
import { RoleSwitcher } from "../shared/RoleSwitcher";
import { usePreviewTimeEdit } from "../shared/usePreviewTimeEdit";
import type { ConversionRole } from "../../../../hooks/useRoleConversion";
import { ReminderToggle } from "../../../shared/ReminderToggle";

interface TaskPreviewPopupProps {
  task: TaskNode;
  position: { x: number; y: number };
  color?: string;
  folderTag?: string;
  onOpenDetail: () => void;
  onStartTimer?: () => void;
  onDelete: () => void;
  onClearSchedule: () => void;
  onClose: () => void;
  onUpdateTitle?: (title: string) => void;
  onUpdateSchedule?: (
    scheduledAt: string,
    scheduledEndAt: string | undefined,
  ) => void;
  onConvertRole?: (targetRole: ConversionRole) => void;
  disabledRoles?: ConversionRole[];
  onUpdateAllDay?: (isAllDay: boolean) => void;
  onUpdateTimeMemo?: (memo: string | null) => void;
  onReminderChange?: (enabled: boolean, offset?: number) => void;
}

function extractTime(iso: string): string {
  const d = new Date(iso);
  return formatTime(d.getHours(), d.getMinutes());
}

function applyTimeToDate(iso: string, time: string): string {
  const d = new Date(iso);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

export function TaskPreviewPopup({
  task,
  position,
  color,
  onOpenDetail,
  onStartTimer,
  onDelete,
  onClearSchedule,
  onClose,
  onUpdateTitle,
  onUpdateSchedule,
  onConvertRole,
  disabledRoles,
  onUpdateAllDay,
  onUpdateTimeMemo,
  onReminderChange,
}: TaskPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleTimeChange = useCallback(
    (start: string, end: string) => {
      if (onUpdateSchedule && task.scheduledAt) {
        onUpdateSchedule(
          applyTimeToDate(task.scheduledAt, start),
          applyTimeToDate(task.scheduledAt, end),
        );
      }
    },
    [onUpdateSchedule, task.scheduledAt],
  );

  const initStart =
    task.scheduledAt && !task.isAllDay
      ? extractTime(task.scheduledAt)
      : "09:00";
  const initEnd =
    task.scheduledEndAt && !task.isAllDay
      ? extractTime(task.scheduledEndAt)
      : "10:00";

  const {
    editStartTime,
    editEndTime,
    handleStartTimeChange,
    handleEndTimeChange,
    isEditingTitle: isEditing,
    titleDraft: editValue,
    setTitleDraft: setEditValue,
    commitTitle: commitEdit,
    startEditingTitle: startEditing,
    cancelEditingTitle: cancelEditing,
  } = usePreviewTimeEdit({
    startTime: initStart,
    endTime: initEnd,
    title: task.title,
    onTimeChange: handleTimeChange,
    onTitleChange: onUpdateTitle,
  });

  useClickOutside(ref, onClose, !showDeleteConfirm && !isEditing);

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 280 - 16);

  const scheduledDate = task.scheduledAt ? new Date(task.scheduledAt) : null;

  return (
    <>
      <div
        ref={ref}
        className="fixed z-50 w-64 bg-notion-bg border border-notion-border rounded-lg shadow-xl"
        style={{ left, top }}
      >
        <div className="p-3 space-y-2">
          {color && (
            <div
              className="w-full h-1 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          {isEditing ? (
            <input
              autoFocus
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  cancelEditing();
                }
              }}
              className="font-medium text-sm text-notion-text w-full bg-transparent border-b border-notion-accent outline-none"
            />
          ) : (
            <div
              className="font-medium text-sm text-notion-text truncate cursor-text hover:bg-notion-hover/50 rounded px-0.5 -mx-0.5"
              onClick={() => {
                if (onUpdateTitle) {
                  startEditing();
                }
              }}
            >
              {task.title}
            </div>
          )}
          {/* Date + All-day */}
          {task.scheduledAt &&
            scheduledDate &&
            (onUpdateSchedule || onUpdateAllDay) && (
              <div className="flex items-center gap-1.5">
                <CalendarDays
                  size={10}
                  className="text-notion-text-secondary shrink-0"
                />
                {onUpdateSchedule ? (
                  <DateInput
                    year={scheduledDate.getFullYear()}
                    month={scheduledDate.getMonth() + 1}
                    day={scheduledDate.getDate()}
                    onChange={(y, m, d) => {
                      const newStart = new Date(task.scheduledAt!);
                      newStart.setFullYear(y, m - 1, d);
                      const newEnd = task.scheduledEndAt
                        ? new Date(task.scheduledEndAt)
                        : undefined;
                      if (newEnd) newEnd.setFullYear(y, m - 1, d);
                      onUpdateSchedule(
                        newStart.toISOString(),
                        newEnd?.toISOString(),
                      );
                    }}
                    size="sm"
                  />
                ) : (
                  <span className="text-xs text-notion-text-secondary">
                    {scheduledDate.getMonth() + 1}/{scheduledDate.getDate()}
                  </span>
                )}
                {onUpdateAllDay && (
                  <label className="flex items-center gap-1 ml-auto cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!task.isAllDay}
                      onChange={(e) => onUpdateAllDay(e.target.checked)}
                      className="w-3 h-3 rounded accent-notion-accent"
                    />
                    <span className="text-[10px] text-notion-text-secondary">
                      {t("calendar.allDay", "All day")}
                    </span>
                  </label>
                )}
              </div>
            )}

          {/* Time (hidden when all-day) */}
          {task.scheduledAt && !task.isAllDay && onUpdateSchedule && (
            <div className="flex items-center gap-1.5">
              <Clock
                size={10}
                className="text-notion-text-secondary shrink-0"
              />
              <TimeInput
                hour={parseInt(editStartTime.split(":")[0], 10)}
                minute={parseInt(editStartTime.split(":")[1], 10)}
                onChange={handleStartTimeChange}
                minuteStep={5}
                size="sm"
              />
              <span className="text-xs text-notion-text-secondary">-</span>
              <TimeInput
                hour={parseInt(editEndTime.split(":")[0], 10)}
                minute={parseInt(editEndTime.split(":")[1], 10)}
                onChange={handleEndTimeChange}
                minuteStep={5}
                size="sm"
              />
            </div>
          )}
          {task.scheduledAt && !task.isAllDay && !onUpdateSchedule && (
            <div className="text-xs text-notion-text-secondary flex items-center gap-1">
              <Clock size={10} />
              {editStartTime} - {editEndTime}
            </div>
          )}
          {/* Memo */}
          {onUpdateTimeMemo && (
            <div className="flex items-center gap-1 px-1 py-0.5 rounded border border-notion-border/50">
              <StickyNote
                size={10}
                className="text-notion-text-secondary shrink-0"
              />
              <input
                type="text"
                defaultValue={task.timeMemo ?? ""}
                onBlur={(e) => {
                  const val = e.target.value;
                  if (val !== (task.timeMemo ?? "")) {
                    onUpdateTimeMemo(val || null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                }}
                placeholder="memo..."
                className="flex-1 text-xs bg-transparent outline-none text-notion-text placeholder:text-notion-text-secondary/50"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

          {onReminderChange && (
            <ReminderToggle
              enabled={!!task.reminderEnabled}
              offset={task.reminderOffset ?? 30}
              onEnabledChange={(enabled) =>
                onReminderChange(enabled, task.reminderOffset)
              }
              onOffsetChange={(offset) =>
                onReminderChange(!!task.reminderEnabled, offset)
              }
              compact
            />
          )}

          <div className="flex items-center gap-2">
            {onConvertRole ? (
              <RoleSwitcher
                currentRole="task"
                disabledRoles={disabledRoles}
                onSelectRole={onConvertRole}
              />
            ) : (
              <span
                className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                  task.status === "DONE"
                    ? "bg-green-100 text-green-700"
                    : "bg-notion-accent/10 text-notion-accent"
                }`}
              >
                {task.status === "DONE"
                  ? "DONE"
                  : task.status === "IN_PROGRESS"
                    ? "IN PROGRESS"
                    : "NOT STARTED"}
              </span>
            )}
          </div>
        </div>
        <div className="border-t border-notion-border flex">
          <button
            onClick={onOpenDetail}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
          >
            <ExternalLink size={12} />
            {t("calendar.openDetail")}
          </button>
          <div className="w-px bg-notion-border" />
          <button
            onClick={onClearSchedule}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
          >
            <X size={14} />
            {t("calendar.clearTime", "Clear time")}
          </button>
        </div>
      </div>
    </>
  );
}
