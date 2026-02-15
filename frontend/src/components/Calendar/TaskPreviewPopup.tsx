import { useRef, useState } from "react";
import { ExternalLink, Play, CalendarOff, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TaskNode } from "../../types/taskTree";
import { useClickOutside } from "../../hooks/useClickOutside";
import { formatScheduleRange } from "../../utils/formatSchedule";
import { truncateFolderTag } from "../../utils/folderTag";
import { ConfirmDialog } from "../common/ConfirmDialog";

interface TaskPreviewPopupProps {
  task: TaskNode;
  position: { x: number; y: number };
  color?: string;
  folderTag?: string;
  onOpenDetail: () => void;
  onStartTimer: () => void;
  onDelete: () => void;
  onClearSchedule: () => void;
  onClose: () => void;
}

export function TaskPreviewPopup({
  task,
  position,
  color,
  folderTag,
  onOpenDetail,
  onStartTimer,
  onDelete,
  onClearSchedule,
  onClose,
}: TaskPreviewPopupProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useClickOutside(ref, onClose, true);

  const left = Math.min(position.x, window.innerWidth - 260 - 16);
  const top = Math.min(position.y, window.innerHeight - 240 - 16);

  return (
    <>
      <div
        ref={ref}
        className="fixed z-50 w-[260px] bg-notion-bg border border-notion-border rounded-lg shadow-xl"
        style={{ left, top }}
      >
        <div className="p-3 space-y-2">
          {color && (
            <div
              className="w-full h-1 rounded-full"
              style={{ backgroundColor: color }}
            />
          )}
          <div className="font-medium text-sm text-notion-text truncate">
            {task.title}
          </div>
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
            {folderTag && (
              <span className="text-[10px] text-notion-text-secondary truncate">
                {truncateFolderTag(folderTag)}
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
            onClick={onStartTimer}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-notion-accent hover:bg-notion-accent/5 transition-colors"
          >
            <Play size={12} />
            {t("calendar.startTimer")}
          </button>
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
