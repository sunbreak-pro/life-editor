import { useRef, useState } from "react";
import { ExternalLink, Play, CalendarOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../../../types/taskTree";
import { useClickOutside } from "../../../../hooks/useClickOutside";
import { formatScheduleRange } from "../../../../utils/formatSchedule";
import { ConfirmDialog } from "../../../shared/ConfirmDialog";

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
}: TaskPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.title);

  useClickOutside(ref, onClose, !showDeleteConfirm && !isEditing);

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
          {task.scheduledAt && (
            <div className="text-xs text-notion-text-secondary">
              {formatScheduleRange(
                task.scheduledAt,
                task.scheduledEndAt,
                task.isAllDay,
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span
              className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full font-medium ${
                task.status === "DONE"
                  ? "bg-green-100 text-green-700"
                  : "bg-notion-accent/10 text-notion-accent"
              }`}
            >
              {task.status === "DONE" ? "DONE" : "TODO"}
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
