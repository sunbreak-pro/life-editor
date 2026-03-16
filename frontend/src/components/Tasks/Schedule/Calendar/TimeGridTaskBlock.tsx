import { Check, StickyNote, X } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { getTextColorForBg } from "../../../../constants/folderColors";
import { formatTimeRangeCompact } from "../../../../utils/formatSchedule";

interface DragHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}

interface TimeGridTaskBlockProps {
  task: TaskNode;
  top: number;
  height: number;
  left: string;
  width: string;
  color?: string;
  tag?: string;
  onClick: (e: React.MouseEvent) => void;
  dragHandlers?: DragHandlers;
  resizeTopHandlers?: DragHandlers;
  resizeBottomHandlers?: DragHandlers;
  isDragging?: boolean;
  onToggleTaskStatus?: (taskId: string) => void;
  onUnschedule?: (taskId: string) => void;
}

export function TimeGridTaskBlock({
  task,
  top,
  height,
  left,
  width,
  color,
  onClick,
  dragHandlers,
  resizeTopHandlers,
  resizeBottomHandlers,
  isDragging,
  onToggleTaskStatus,
  onUnschedule,
}: TimeGridTaskBlockProps) {
  const isCompleted = task.status === "DONE";
  const bgColor = isCompleted ? "rgba(156,163,175,0.15)" : (color ?? "#E0E7FF");
  const textColor = isCompleted
    ? "#9CA3AF"
    : color
      ? getTextColorForBg(color)
      : "#4338CA";
  const borderColor = isCompleted ? "#9CA3AF" : textColor;
  const isCompact = height < 40;
  const hasContent = !!task.content;

  return (
    <div
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick(e);
      }}
      onMouseDown={dragHandlers?.onMouseDown}
      onTouchStart={dragHandlers?.onTouchStart}
      className={`absolute rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity text-left group ${
        isCompleted ? "opacity-50" : ""
      }`}
      style={{
        top,
        left,
        width,
        height: Math.max(height, 20),
        backgroundColor: bgColor,
        borderLeft: `3px solid ${borderColor}`,
        zIndex: 10,
        opacity: isDragging ? 0.4 : undefined,
      }}
    >
      {/* Resize handle - top */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          resizeTopHandlers?.onMouseDown(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resizeTopHandlers?.onTouchStart(e);
        }}
      />

      <div
        className="px-1.5 py-0.5 h-full flex items-start gap-0.5"
        style={{ color: textColor }}
      >
        {/* Checkbox */}
        {onToggleTaskStatus && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTaskStatus(task.id);
            }}
            className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              isCompleted
                ? "bg-gray-400 border-gray-400"
                : "border-current hover:bg-current/10"
            }`}
          >
            {isCompleted && <Check size={10} className="text-white" />}
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-0.5">
            <span
              className={`font-medium truncate ${isCompact ? "text-[10px]" : "text-xs"} ${
                isCompleted ? "line-through text-gray-400" : ""
              }`}
            >
              {task.title}
            </span>
            <span
              className={`shrink-0 ${
                hasContent ? "opacity-70" : "opacity-0 group-hover:opacity-50"
              }`}
            >
              <StickyNote size={15} />
            </span>
          </div>
          {!isCompact && task.scheduledAt && (
            <div className="text-[10px] truncate opacity-70">
              {formatTimeRangeCompact(task.scheduledAt, task.scheduledEndAt)}
            </div>
          )}
        </div>
        {/* Unschedule button */}
        {onUnschedule && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnschedule(task.id);
            }}
            className="shrink-0 mt-0.5 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 transition-all"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {/* Resize handle - bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 z-10"
        onMouseDown={(e) => {
          e.stopPropagation();
          resizeBottomHandlers?.onMouseDown(e);
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          resizeBottomHandlers?.onTouchStart(e);
        }}
      />
    </div>
  );
}
