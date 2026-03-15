import { StickyNote } from "lucide-react";
import type { TaskNode } from "../../../../types/taskTree";
import { getTextColorForBg } from "../../../../constants/folderColors";
import { formatTimeRangeCompact } from "../../../../utils/formatSchedule";

interface TimeGridTaskBlockProps {
  task: TaskNode;
  top: number;
  height: number;
  left: string;
  width: string;
  color?: string;
  tag?: string;
  onClick: (e: React.MouseEvent) => void;
  dragHandlers?: {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
  };
  isDragging?: boolean;
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
  isDragging,
}: TimeGridTaskBlockProps) {
  const bgColor = color ?? "#E0E7FF";
  const textColor = color ? getTextColorForBg(color) : "#4338CA";
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
      className="absolute rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity text-left group"
      style={{
        top,
        left,
        width,
        height: Math.max(height, 20),
        backgroundColor: bgColor,
        borderLeft: `3px solid ${textColor}`,
        zIndex: 10,
        opacity: isDragging ? 0.4 : undefined,
      }}
    >
      <div
        className="px-1.5 py-0.5 h-full flex items-start gap-0.5"
        style={{ color: textColor }}
      >
        <div className="flex-1 min-w-0">
          <div
            className={`font-medium truncate ${isCompact ? "text-[10px]" : "text-xs"}`}
          >
            {task.title}
          </div>
          {!isCompact && task.scheduledAt && (
            <div className="text-[10px] truncate opacity-70">
              {formatTimeRangeCompact(task.scheduledAt, task.scheduledEndAt)}
            </div>
          )}
        </div>
        <div
          className={`shrink-0 mt-0.5 ${
            hasContent ? "opacity-70" : "opacity-0 group-hover:opacity-50"
          }`}
        >
          <StickyNote size={10} />
        </div>
      </div>
    </div>
  );
}
