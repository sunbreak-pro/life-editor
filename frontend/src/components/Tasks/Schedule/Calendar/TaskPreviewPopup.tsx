import { useRef, useState } from "react";
import { ExternalLink, Play, CalendarOff, Trash2, Clock } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../../types/taskTree";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { formatScheduleRange } from "../../../../utils/formatSchedule";
import { ConfirmDialog } from "../../../shared/ConfirmDialog";
import { TimeInput } from "../../../shared/TimeInput";
import {
  clampEndTimeAfterStart,
  adjustEndTimeForStartChange,
} from "../../../../utils/timeGridUtils";

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
}

function extractTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
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
}: TaskPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [editStartTime, setEditStartTime] = useState(
    task.scheduledAt && !task.isAllDay
      ? extractTime(task.scheduledAt)
      : "09:00",
  );
  const [editEndTime, setEditEndTime] = useState(
    task.scheduledEndAt && !task.isAllDay
      ? extractTime(task.scheduledEndAt)
      : "10:00",
  );
  const prevStartRef = useRef(editStartTime);

  const handleStartTimeChange = (h: number, m: number) => {
    const newStart = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const adjusted = adjustEndTimeForStartChange(
      prevStartRef.current,
      newStart,
      editEndTime,
    );
    prevStartRef.current = newStart;
    setEditStartTime(newStart);
    setEditEndTime(adjusted);
  };

  const handleEndTimeChange = (h: number, m: number) => {
    const newEnd = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    setEditEndTime(clampEndTimeAfterStart(editStartTime, newEnd));
  };

  const handleTimeSave = () => {
    if (onUpdateSchedule && task.scheduledAt) {
      const newStart = applyTimeToDate(task.scheduledAt, editStartTime);
      const newEnd = applyTimeToDate(task.scheduledAt, editEndTime);
      onUpdateSchedule(newStart, newEnd);
    }
    setIsEditingTime(false);
  };

  useClickOutside(
    ref,
    onClose,
    !showDeleteConfirm && !isEditing && !isEditingTime,
  );

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== task.title) {
      onUpdateTitle?.(trimmed);
    }
    setIsEditing(false);
  };

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 240 - 16);

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
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") {
                  setEditValue(task.title);
                  setIsEditing(false);
                }
              }}
              className="font-medium text-sm text-notion-text w-full bg-transparent border-b border-notion-accent outline-none"
            />
          ) : (
            <div
              className="font-medium text-sm text-notion-text truncate cursor-text hover:bg-notion-hover/50 rounded px-0.5 -mx-0.5"
              onClick={() => {
                if (onUpdateTitle) {
                  setEditValue(task.title);
                  setIsEditing(true);
                }
              }}
            >
              {task.title}
            </div>
          )}
          {task.scheduledAt &&
            (isEditingTime && onUpdateSchedule ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
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
                <div className="flex gap-1">
                  <button
                    onClick={handleTimeSave}
                    className="px-2 py-0.5 text-[10px] bg-notion-accent text-white rounded hover:opacity-90 transition-colors"
                  >
                    {t("common.save", "Save")}
                  </button>
                  <button
                    onClick={() => {
                      setEditStartTime(
                        task.scheduledAt && !task.isAllDay
                          ? extractTime(task.scheduledAt)
                          : "09:00",
                      );
                      setEditEndTime(
                        task.scheduledEndAt && !task.isAllDay
                          ? extractTime(task.scheduledEndAt)
                          : "10:00",
                      );
                      setIsEditingTime(false);
                    }}
                    className="px-2 py-0.5 text-[10px] text-notion-text-secondary hover:text-notion-text transition-colors"
                  >
                    {t("common.cancel", "Cancel")}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => onUpdateSchedule && setIsEditingTime(true)}
                className={`text-xs text-notion-text-secondary flex items-center gap-1 ${
                  onUpdateSchedule
                    ? "hover:text-notion-text cursor-pointer"
                    : "cursor-default"
                } transition-colors`}
              >
                <Clock size={10} />
                {formatScheduleRange(
                  task.scheduledAt,
                  task.scheduledEndAt,
                  task.isAllDay,
                )}
              </button>
            ))}
          <div className="flex items-center gap-2">
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
          {onStartTimer && (
            <>
              <div className="w-px bg-notion-border" />
              <button
                onClick={onStartTimer}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-accent hover:bg-notion-accent/5 transition-colors"
              >
                <Play size={12} />
                {t("calendar.startTimer")}
              </button>
            </>
          )}
        </div>
        <div className="border-t border-notion-border flex">
          <button
            onClick={onClearSchedule}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-text-secondary hover:bg-notion-hover hover:text-notion-text transition-colors"
          >
            <CalendarOff size={12} />
            {t("calendar.clearSchedule")}
          </button>
          <div className="w-px bg-notion-border" />
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:bg-red-500/5 transition-colors"
          >
            <Trash2 size={12} />
            {t("common.delete")}
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title={t("calendar.deleteTaskTitle")}
          message={t("calendar.deleteTaskMessage")}
          onConfirm={onDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
}
